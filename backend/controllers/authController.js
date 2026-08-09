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
        message: "An account with this email address already exists",
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
      if (!website || !website.trim()) {
        return res.status(400).json({
          success: false,
          message: "Official company website URL is required for recruiter registration",
        });
      }

      const recEmail = (officialEmail || email).toLowerCase();
      const existingRecruiter = await Recruiter.findOne({ officialEmail: recEmail });
      if (existingRecruiter) {
        return res.status(409).json({
          success: false,
          message: "A recruiter with this official email address already exists",
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

      console.log(`[Registration WHOIS] ${companyName}: trustScore=${verification.trustScore}, domainAge=${verification.breakdown.domainAge}, emailMatch=${verification.breakdown.emailMatch}, whoisAgeYears=${verification.whoisData.domainAgeYears}`);

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
          mcaData: verification.mcaData,
          directors: verification.directors,
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
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address or official details already exists",
      });
    }
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

    // 1. Student Check: must be pre-imported by TPO
    if (user.role === "Student") {
      const studentProfile = await Student.findOne({ userId: user._id });
      if (!studentProfile) {
        return res.status(403).json({
          success: false,
          message: "Only pre-imported students by the TPO are allowed to access this portal.",
        });
      }
    }

    // 2. Recruiter Check: check approval/on-hold/pending status
    let recruiterDetails = null;
    if (user.role === "Recruiter") {
      recruiterDetails = await Recruiter.findOne({ userId: user._id });
      if (recruiterDetails) {
        const regStatus = recruiterDetails.registrationStatus || (recruiterDetails.isApproved ? "approved" : "pending");

        if (regStatus === "on_hold") {
          const token = generateToken(user);
          return res.status(403).json({
            success: false,
            message: "Your company application is currently on hold for this year's placement drive.",
            status: "ON_HOLD",
            companyName: recruiterDetails.companyName,
            feedback: recruiterDetails.holdFeedback?.message || "",
            suggestions: recruiterDetails.holdFeedback?.suggestions || "",
            canEdit: true,
            token,
          });
        }

        if (regStatus === "pending") {
          return res.status(403).json({
            success: false,
            message: "Your account is pending TPO approval. You will receive an email once approved.",
            isApproved: false,
            status: "PENDING",
            companyName: recruiterDetails.companyName,
            tpoSuggestions: recruiterDetails.tpoSuggestions || [],
          });
        }

        // Ensure legacy isApproved is synced
        if (regStatus === "approved" && !recruiterDetails.isApproved) {
          recruiterDetails.isApproved = true;
          recruiterDetails.status = "Approved";
          await recruiterDetails.save();
        }
      }
    }

    if (!user.isActive && user.role !== "Recruiter") {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
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

const googleLogin = async (req, res) => {
  try {
    const { token, email: requestedEmail, name: requestedName } = req.body;
    
    let email = requestedEmail;
    let name = requestedName;

    // Verify Google ID token if CLIENT ID is set
    if (process.env.GOOGLE_CLIENT_ID && token) {
      try {
        const { OAuth2Client } = require("google-auth-library");
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
          idToken: token,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
      } catch (err) {
        console.warn("Google Token verification failed, falling back to body:", err.message);
      }
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required for Google Sign-In",
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Your Google email is not registered in our database. Students must be pre-imported by the TPO. Recruiters must register first.",
      });
    }

    // 1. Student Check: must be pre-imported by TPO
    if (user.role === "Student") {
      const studentProfile = await Student.findOne({ userId: user._id });
      if (!studentProfile) {
        return res.status(403).json({
          success: false,
          message: "Only pre-imported students by the TPO are allowed to access this portal.",
        });
      }
    }

    // 2. Recruiter Check: check approval/rejection/pending status
    let recruiterDetails = null;
    if (user.role === "Recruiter") {
      recruiterDetails = await Recruiter.findOne({ userId: user._id });
      if (recruiterDetails) {
        if (recruiterDetails.isApproved) {
          if (recruiterDetails.status !== "Approved") {
            recruiterDetails.status = "Approved";
            await recruiterDetails.save();
          }
        } else {
          if (recruiterDetails.status === "Rejected") {
            return res.status(403).json({
              success: false,
              message: "Your recruiter application has been rejected by the TPO.",
              status: "Rejected",
              companyName: recruiterDetails.companyName,
            });
          }

          return res.status(403).json({
            success: false,
            message: "Your account is pending TPO approval. You will receive an email once approved.",
            isApproved: false,
            status: "Pending",
            companyName: recruiterDetails.companyName,
            tpoSuggestions: recruiterDetails.tpoSuggestions || [],
          });
        }
      }
    }

    if (!user.isActive && user.role !== "Recruiter") {
      return res.status(403).json({
        success: false,
        message: "This account is inactive",
      });
    }

    const jwtToken = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Google Login successful",
      token: jwtToken,
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
      message: "Google Sign-In failed",
      error: error.message,
    });
  }
};

const getGoogleClientId = (req, res) => {
  return res.status(200).json({
    clientId: process.env.GOOGLE_CLIENT_ID || null,
  });
};

const resetCodes = new Map();

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "No user found with this email address" });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(email.toLowerCase(), {
      code,
      expires: Date.now() + 15 * 60 * 1000 // 15 mins validity
    });

    console.log(`[PASSWORD RESET] Email: ${email} | Code: ${code}`);

    return res.status(200).json({
      success: true,
      message: "A password reset code has been logged to the server console.",
      code // Return it for easy local testing/usage!
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to send reset code", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, code, and newPassword are required" });
    }

    const record = resetCodes.get(email.toLowerCase());
    if (!record) {
      return res.status(400).json({ success: false, message: "No reset request active for this email" });
    }

    if (record.code !== code.toString()) {
      return res.status(400).json({ success: false, message: "Invalid reset code" });
    }

    if (Date.now() > record.expires) {
      return res.status(400).json({ success: false, message: "Reset code has expired" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.password = newPassword;
    await user.save();

    resetCodes.delete(email.toLowerCase());

    return res.status(200).json({
      success: true,
      message: "Your password has been successfully reset. Please log in using your new password."
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to reset password", error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  googleLogin,
  getGoogleClientId,
  forgotPassword,
  resetPassword,
};
