const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Recruiter = require("../models/Recruiter");
const Student = require("../models/Student");
const verificationService = require("../services/verificationService");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, companyName, coverNote, website, officialEmail } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and role are required",
      });
    }

    const allowedRoles = ["Student", "Recruiter", "TPO"];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be Student, Recruiter, or TPO",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    // Additional validation for Recruiter registration
    if (role === "Recruiter") {
      if (!companyName || !companyName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Company name is required for recruiter registration",
        });
      }
      if (!coverNote || !coverNote.trim()) {
        return res.status(400).json({
          success: false,
          message: "Cover note / Introduction letter is required for recruiter registration",
        });
      }
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      phone,
    });

    let recruiterRecord = null;
    if (role === "Recruiter") {
      const recEmail = (officialEmail || email).toLowerCase();
      // Automated WHOIS & Email Verification & Trust Score calculation
      const verification = await verificationService.calculateTrustScore({
        website,
        officialEmail: recEmail,
        companyName,
      });

      recruiterRecord = await Recruiter.create({
        userId: user._id,
        companyName: companyName.trim(),
        coverNote: coverNote ? coverNote.trim() : null,
        website: website || null,
        officialEmail: recEmail,
        isApproved: false,
        trustScore: verification.trustScore,
        verificationDetails: {
          breakdown: verification.breakdown,
          whoisData: verification.whoisData,
          verifiedAt: verification.verifiedAt,
        },
      });
    }

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: role === "Recruiter"
        ? "Recruiter registered successfully. Account is pending TPO approval."
        : "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        isApproved: recruiterRecord ? recruiterRecord.isApproved : true,
        recruiter: recruiterRecord,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    // Phase 1: Login Blocking for Unapproved Recruiters
    let recruiterDetails = null;
    if (user.role.toLowerCase() === "recruiter") {
      recruiterDetails = await Recruiter.findOne({ userId: user._id });
      if (recruiterDetails && !recruiterDetails.isApproved) {
        return res.status(403).json({
          success: false,
          message: "Your account is pending TPO approval. You will receive an email once approved.",
          isApproved: false,
          companyName: recruiterDetails.companyName,
          tpoSuggestions: recruiterDetails.tpoSuggestions || [],
        });
      }
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        recruiter: recruiterDetails,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let profileData = null;
    if (user.role === "Student") {
      profileData = await Student.findOne({ userId: user._id });
    } else if (user.role === "Recruiter") {
      profileData = await Recruiter.findOne({ userId: user._id });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        profile: profileData,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load current user",
      error: error.message,
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
};
