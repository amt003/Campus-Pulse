const User = require("../models/User");
const Student = require("../models/Student");
const Recruiter = require("../models/Recruiter");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const CollegeConfig = require("../models/CollegeConfig");
const Schedule = require("../models/Schedule");
const verificationService = require("../services/verificationService");
const socketService = require("../services/socketService");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../utils/emailTemplates");
const placementAnalyzerService = require("../services/placementAnalyzerService");

// 0. GET /api/tpo/students — Full students list with filters & pagination
const getStudentsList = async (req, res) => {
  try {
    const {
      search = "",
      branch = "",
      passoutYear = "",
      minCgpa = "",
      maxCgpa = "",
      activeBacklogs = "",
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build student-level filters
    const studentFilter = {};
    if (branch) studentFilter.branch = branch;
    if (passoutYear) studentFilter.passoutYear = Number(passoutYear);
    if (minCgpa !== "") studentFilter.cgpa = { ...studentFilter.cgpa, $gte: Number(minCgpa) };
    if (maxCgpa !== "") studentFilter.cgpa = { ...studentFilter.cgpa, $lte: Number(maxCgpa) };
    if (activeBacklogs !== "") studentFilter.activeBacklogs = Number(activeBacklogs);

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const sortObj = {};
    sortObj[sortBy === "cgpa" ? "cgpa" : sortBy === "passoutYear" ? "passoutYear" : "createdAt"] =
      sortOrder === "asc" ? 1 : -1;

    // Fetch matching students, populate user
    let students = await Student.find(studentFilter)
      .populate("userId", "name email phone isActive createdAt")
      .sort(sortObj)
      .lean();

    // Apply search on populated user fields or rollNumber
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      students = students.filter((s) => {
        const name = s.userId?.name?.toLowerCase() || "";
        const email = s.userId?.email?.toLowerCase() || "";
        const roll = s.rollNumber?.toLowerCase() || "";
        return name.includes(q) || email.includes(q) || roll.includes(q);
      });
    }

    const total = students.length;
    const paginated = students.slice(skip, skip + limitNum);

    // Build distinct filter options for frontend dropdowns
    const allBranches = await Student.distinct("branch");
    const allYears = await Student.distinct("passoutYear");

    return res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      filterOptions: {
        branches: allBranches.sort(),
        passoutYears: allYears.sort((a, b) => b - a),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students list",
      error: error.message,
    });
  }
};

// 1. GET /api/tpo/analytics
const getDashboardAnalytics = async (req, res) => {
  try {
    const [
      totalStudents,
      placedApplications,
      activeDrives,
      pendingApprovals,
    ] = await Promise.all([
      Student.countDocuments(),
      Application.distinct("studentId", {
        $or: [{ status: { $in: ["Placed", "Offer Accepted"] } }, { "offer.status": "Accepted" }]
      }),
      JobDrive.countDocuments({ status: "Open" }),
      Recruiter.countDocuments({
        isApproved: false,
        status: { $nin: ["OnHold", "Rejected"] },
        registrationStatus: { $ne: "on_hold" },
      }),
    ]);

    const totalPlaced = placedApplications.length;
    const totalUnplaced = Math.max(0, totalStudents - totalPlaced);
    const placementPercentage = totalStudents > 0 ? Number(((totalPlaced / totalStudents) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      totalStudents,
      totalPlaced,
      totalUnplaced,
      placementPercentage,
      activeDrives,
      pendingApprovals,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load dashboard analytics",
      error: error.message,
    });
  }
};

// 2. GET /api/tpo/funnel
const getPlacementFunnel = async (req, res) => {
  try {
    const [
      totalApplied,
      aptitudeCleared,
      gdCleared,
      interviewed,
      totalPlaced,
    ] = await Promise.all([
      Application.countDocuments(),
      Application.countDocuments({
        $or: [
          { "aptitude.status": { $in: ["Passed", "Completed"] } },
          { status: { $in: ["Aptitude Completed", "GD Scheduled", "GD Completed", "Interview Scheduled", "Interview Completed", "Selected", "Offer Sent", "Offer Accepted", "Placed"] } }
        ]
      }),
      Application.countDocuments({
        $or: [
          { "gd.status": { $in: ["Shortlisted", "Completed"] } },
          { status: { $in: ["GD Completed", "Interview Scheduled", "Interview Completed", "Selected", "Offer Sent", "Offer Accepted", "Placed"] } }
        ]
      }),
      Application.countDocuments({
        $or: [
          { "interview.status": "Completed" },
          { "interview.result": "Selected" },
          { status: { $in: ["Selected", "Offer Sent", "Offer Accepted", "Placed"] } }
        ]
      }),
      Application.countDocuments({
        $or: [{ status: { $in: ["Placed", "Offer Accepted"] } }, { "offer.status": "Accepted" }]
      }),
    ]);

    const funnel = [
      { stage: "Applied", count: totalApplied },
      { stage: "Aptitude Cleared", count: aptitudeCleared },
      { stage: "GD Cleared", count: gdCleared },
      { stage: "Interviewed", count: interviewed },
      { stage: "Placed", count: totalPlaced },
    ];

    return res.status(200).json(funnel);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch placement funnel data",
      error: error.message,
    });
  }
};

// 3. GET /api/tpo/branch-stats
const getBranchWiseStats = async (req, res) => {
  try {
    const branchStudents = await Student.aggregate([
      {
        $group: {
          _id: "$branch",
          total: { $sum: 1 },
          studentIds: { $push: "$_id" },
        },
      },
    ]);

    const branchStats = await Promise.all(
      branchStudents.map(async (b) => {
        const placedCount = await Application.distinct("studentId", {
          studentId: { $in: b.studentIds },
          status: "Placed",
        });

        const placed = placedCount.length;
        const percentage = b.total > 0 ? Number(((placed / b.total) * 100).toFixed(1)) : 0;

        return {
          branch: b._id || "Other",
          total: b.total,
          placed,
          percentage,
        };
      })
    );

    branchStats.sort((a, b) => b.percentage - a.percentage);
    return res.status(200).json(branchStats);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch branch-wise placement statistics",
      error: error.message,
    });
  }
};

// 4. GET /api/tpo/offer-trends
const getOfferAcceptanceTrends = async (req, res) => {
  try {
    const [accepted, declined, totalOffers] = await Promise.all([
      Application.countDocuments({ "offer.status": "Accepted" }),
      Application.countDocuments({ "offer.status": "Declined" }),
      Application.countDocuments({ "offer.status": { $ne: "Not Sent" } }),
    ]);

    const acceptanceRate = totalOffers > 0 ? Number(((accepted / totalOffers) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      totalOffers,
      accepted,
      declined,
      acceptanceRate,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch offer trends",
      error: error.message,
    });
  }
};

// 5. GET /api/tpo/recruiters/pending (Enhanced with verification details)
const getPendingRecruiters = async (req, res) => {
  try {
    const pendingRecruiters = await Recruiter.find({
      isApproved: false,
      status: { $nin: ["OnHold", "Rejected"] },
      registrationStatus: { $ne: "on_hold" },
    })
      .populate("userId", "name email phone isActive createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: pendingRecruiters,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending recruiters",
      error: error.message,
    });
  }
};

// 5.5 GET /api/tpo/recruiters/approved
const getApprovedRecruiters = async (req, res) => {
  try {
    const approvedRecruiters = await Recruiter.find({ isApproved: true })
      .populate("userId", "name email phone isActive createdAt")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: approvedRecruiters,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch approved recruiters",
      error: error.message,
    });
  }
};

// 5.6 GET /api/tpo/recruiters/on-hold
const getOnHoldRecruiters = async (req, res) => {
  try {
    const onHoldRecruiters = await Recruiter.find({
      $or: [
        { status: "OnHold" },
        { registrationStatus: "on_hold" },
        { status: "Rejected" },
      ],
    })
      .populate("userId", "name email phone isActive createdAt")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: onHoldRecruiters,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch on-hold recruiters",
      error: error.message,
    });
  }
};

// 6. GET /api/tpo/recruiter/:id/verify
const getRecruiterVerificationDetails = async (req, res) => {
  try {
    const recruiter = await Recruiter.findById(req.params.id).populate(
      "userId",
      "name email phone createdAt"
    );

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        recruiterId: recruiter._id,
        companyName: recruiter.companyName,
        officialEmail: recruiter.officialEmail,
        website: recruiter.website,
        coverNote: recruiter.coverNote,
        isApproved: recruiter.isApproved,
        trustScore: recruiter.trustScore || 85,
        verificationDetails: recruiter.verificationDetails || {},
        user: recruiter.userId,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recruiter verification details",
      error: error.message,
    });
  }
};

// 7. PUT /api/tpo/recruiter/:id/approve
const approveRecruiter = async (req, res) => {
  try {
    const recruiter = await Recruiter.findById(req.params.id);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    recruiter.isApproved = true;
    recruiter.status = "Approved";
    recruiter.registrationStatus = "approved";
    recruiter.verifiedAt = new Date();
    recruiter.holdFeedback = { message: "", suggestions: "", providedBy: null, providedAt: null };
    await recruiter.save();

    if (recruiter.userId) {
      await User.findByIdAndUpdate(recruiter.userId, { isActive: true });
      await socketService.sendRealTimeNotification(recruiter.userId, {
        title: "Account Approved ⭐",
        message: `Congratulations! The TPO has approved your recruiter account for ${recruiter.companyName}. You can now start posting job drives.`,
        type: "success",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Recruiter approved successfully",
      recruiter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve recruiter",
      error: error.message,
    });
  }
};


// 8. PUT /api/tpo/recruiter/:id/reject (kept for backward compat, not exposed in UI)
const rejectRecruiter = async (req, res) => {
  try {
    const recruiter = await Recruiter.findById(req.params.id);

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    recruiter.isApproved = false;
    recruiter.status = "Rejected";
    recruiter.registrationStatus = "on_hold";
    await recruiter.save();

    if (recruiter.userId) {
      await User.findByIdAndUpdate(recruiter.userId, { isActive: false });
    }

    return res.status(200).json({
      success: true,
      message: "Recruiter application rejected successfully",
      recruiter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject recruiter",
      error: error.message,
    });
  }
};

// 8b. PUT /api/tpo/recruiter/:id/hold — puts recruiter on hold with feedback
const putRecruiterOnHold = async (req, res) => {
  try {
    const { feedback, suggestions } = req.body;

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback message is required when putting a recruiter on hold.",
      });
    }

    const recruiter = await Recruiter.findById(req.params.id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    recruiter.isApproved = false;
    recruiter.status = "OnHold";
    recruiter.registrationStatus = "on_hold";
    recruiter.holdFeedback = {
      message: feedback.trim(),
      suggestions: (suggestions || "").trim(),
      providedBy: req.user._id,
      providedAt: new Date(),
    };
    await recruiter.save();

    // Keep user account active so they can access the edit-profile page
    if (recruiter.userId) {
      await User.findByIdAndUpdate(recruiter.userId, { isActive: true });
      await socketService.sendRealTimeNotification(recruiter.userId, {
        title: "Account On Hold ⚠️",
        message: `TPO Review Required: "${feedback.trim()}"`,
        type: "warning",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Recruiter placed on hold successfully. Feedback has been recorded.",
      recruiter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to put recruiter on hold",
      error: error.message,
    });
  }
};

// 9. POST /api/tpo/import-students
const bulkImportStudents = async (req, res) => {
  try {
    const { students } = req.body;
    let studentList = null;

    if (Array.isArray(students)) {
      studentList = students;
    } else if (students && typeof students === "object") {
      studentList = [students];
    } else if (Array.isArray(req.body)) {
      studentList = req.body;
    } else if (req.body && typeof req.body === "object" && req.body.rollNumber) {
      studentList = [req.body];
    }

    if (!studentList || studentList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide student details (single student object or array) to import.",
      });
    }

    const createdRecords = [];
    const errors = [];

    for (const [index, item] of studentList.entries()) {
      try {
        const { rollNumber, name, email, phone, cgpa, branch, passoutYear, activeBacklogs } = item;

        if (!name || !email || !rollNumber || cgpa === undefined || !branch || !passoutYear) {
          errors.push({ index, email: email || rollNumber, error: "Missing required fields (rollNumber, name, email, cgpa, branch, passoutYear)" });
          continue;
        }

        // Check 1: Duplicate by email
        let user = await User.findOne({ email: email.toString().toLowerCase().trim() });
        if (user) {
          errors.push({ index, email, error: `Student with email "${email}" already exists in the system.` });
          continue;
        }

        // Check 2: Duplicate by roll number
        const existingStudent = await Student.findOne({ rollNumber: rollNumber.toString().trim() });
        if (existingStudent) {
          errors.push({ index, email, rollNumber, error: `Student with Roll Number "${rollNumber}" already exists.` });
          continue;
        }

        // Create User account for student
        user = await User.create({
          name: name.toString().trim(),
          email: email.toString().toLowerCase().trim(),
          password: rollNumber.toString().trim(), // Default password is their roll number
          role: "Student",
          phone: phone ? phone.toString().trim() : "",
          isActive: true,
        });

        // Create Student profile
        const student = await Student.create({
          userId: user._id,
          rollNumber: rollNumber.toString().trim(),
          cgpa: Number(cgpa),
          branch: branch.toString().trim(),
          passoutYear: Number(passoutYear),
          activeBacklogs: Number(activeBacklogs || 0),
          isProfileComplete: true,
        });

        createdRecords.push({
          userId: user._id,
          studentId: student._id,
          email: user.email,
          rollNumber: student.rollNumber,
          name: user.name,
        });
      } catch (err) {
        errors.push({ index, email: item.email, error: err.message });
      }
    }

    if (createdRecords.length === 0 && errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Import failed: ${errors[0].error}`,
        importedCount: 0,
        errorsCount: errors.length,
        errors,
      });
    }

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdRecords.length} student(s)! Default password is their roll number.`,
      note: "Students can login using their roll number as the default password.",
      importedCount: createdRecords.length,
      errorsCount: errors.length,
      imported: createdRecords,
      errors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to import students",
      error: error.message,
    });
  }
};

// 10. POST /api/tpo/recruiter/:id/suggestion
const addRecruiterSuggestion = async (req, res) => {
  try {
    const { suggestion } = req.body;
    if (!suggestion || !suggestion.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid suggestion or feedback text",
      });
    }

    const recruiter = await Recruiter.findById(req.params.id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter not found",
      });
    }

    if (!Array.isArray(recruiter.tpoSuggestions)) {
      recruiter.tpoSuggestions = [];
    }

    recruiter.tpoSuggestions.push({
      suggestion: suggestion.trim(),
      sentAt: new Date(),
    });

    await recruiter.save();

    return res.status(200).json({
      success: true,
      message: "Feedback & suggestions sent to recruiter successfully",
      tpoSuggestions: recruiter.tpoSuggestions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to send suggestion to recruiter",
      error: error.message,
    });
  }
};

// 11. PUT /api/tpo/recruiter/:id/toggle-status
const toggleRecruiterStatus = async (req, res) => {
  try {
    const recruiter = await Recruiter.findById(req.params.id).populate("userId");
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const nextState = !recruiter.isApproved;
    recruiter.isApproved = nextState;

    if (recruiter.userId) {
      recruiter.userId.isActive = nextState;
      await recruiter.userId.save();
    }

    await recruiter.save();

    return res.status(200).json({
      success: true,
      message: `Recruiter successfully ${nextState ? "activated" : "deactivated"}`,
      isApproved: recruiter.isApproved,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to toggle recruiter status",
      error: error.message,
    });
  }
};

// Re-verify a recruiter's trust score (useful for existing recruiters where WHOIS timed out)
const reVerifyRecruiter = async (req, res) => {
  try {
    const recruiter = await Recruiter.findById(req.params.id);
    if (!recruiter) {
      return res.status(404).json({ success: false, message: "Recruiter not found" });
    }

    const verification = await verificationService.calculateTrustScore({
      website: recruiter.website,
      officialEmail: recruiter.officialEmail,
      companyName: recruiter.companyName,
    });

    console.log(`[Re-verify] ${recruiter.companyName}: trustScore=${verification.trustScore}, domainAge=${verification.breakdown.domainAge}, emailMatch=${verification.breakdown.emailMatch}`);
    console.log(`[Re-verify] WHOIS: domain=${verification.whoisData.domain}, ageYears=${verification.whoisData.domainAgeYears}, registrar=${verification.whoisData.registrar}`);

    // Use findByIdAndUpdate with $set for reliable nested object persistence
    const updated = await Recruiter.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          trustScore: verification.trustScore,
          "verificationDetails.breakdown.domainAge": verification.breakdown.domainAge,
          "verificationDetails.breakdown.emailMatch": verification.breakdown.emailMatch,
          "verificationDetails.breakdown.mca": verification.breakdown.mca,
          "verificationDetails.whoisData.domain": verification.whoisData.domain,
          "verificationDetails.whoisData.creationDate": verification.whoisData.creationDate,
          "verificationDetails.whoisData.domainAgeYears": verification.whoisData.domainAgeYears,
          "verificationDetails.whoisData.registrar": verification.whoisData.registrar,
          "verificationDetails.whoisData.registrantCountry": verification.whoisData.registrantCountry,
          "verificationDetails.whoisData.isValid": verification.whoisData.isValid,
          "verificationDetails.mcaData": verification.mcaData,
          "verificationDetails.directors": verification.directors,
          "verificationDetails.verifiedAt": verification.verifiedAt,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Trust score re-verified successfully",
      trustScore: updated.trustScore,
      breakdown: updated.verificationDetails.breakdown,
      whoisData: updated.verificationDetails.whoisData,
      mcaData: updated.verificationDetails.mcaData,
      directors: updated.verificationDetails.directors,
    });
  } catch (error) {
    console.error("[Re-verify] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to re-verify recruiter",
      error: error.message,
    });
  }
};

// Phase 5: Re-verify recruiter using both WHOIS and Indian BizVerify MCA MCP server
const reverifyRecruiter = async (req, res) => {
  try {
    const recruiter = await Recruiter.findById(req.params.id);
    if (!recruiter) {
      return res.status(404).json({ success: false, message: "Recruiter not found" });
    }

    const verification = await verificationService.calculateTrustScore({
      website: recruiter.website,
      officialEmail: recruiter.officialEmail,
      companyName: recruiter.companyName,
    });

    console.log(`[MCA & WHOIS Re-verify] ${recruiter.companyName}: trustScore=${verification.trustScore}, mcaScore=${verification.breakdown.mca}`);

    const updated = await Recruiter.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          trustScore: verification.trustScore,
          "verificationDetails.breakdown.domainAge": verification.breakdown.domainAge,
          "verificationDetails.breakdown.emailMatch": verification.breakdown.emailMatch,
          "verificationDetails.breakdown.mca": verification.breakdown.mca,
          "verificationDetails.whoisData.domain": verification.whoisData.domain,
          "verificationDetails.whoisData.creationDate": verification.whoisData.creationDate,
          "verificationDetails.whoisData.domainAgeYears": verification.whoisData.domainAgeYears,
          "verificationDetails.whoisData.registrar": verification.whoisData.registrar,
          "verificationDetails.whoisData.registrantCountry": verification.whoisData.registrantCountry,
          "verificationDetails.whoisData.isValid": verification.whoisData.isValid,
          "verificationDetails.mcaData": verification.mcaData,
          "verificationDetails.directors": verification.directors,
          "verificationDetails.verifiedAt": verification.verifiedAt,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Recruiter verification re-verified successfully",
      data: updated,
    });
  } catch (error) {
    console.error("[MCA Re-verify] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to re-verify recruiter",
      error: error.message,
    });
  }
};

const getPendingDrives = async (req, res) => {
  try {
    const drives = await JobDrive.find({ status: "Pending" })
      .populate("recruiterId", "name email companyName officialEmail website phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      drives,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending drives",
      error: error.message,
    });
  }
};

const approveDrive = async (req, res) => {
  try {
    const { id } = req.params;
    const drive = await JobDrive.findById(id).populate("recruiterId");

    if (!drive) {
      return res.status(404).json({ success: false, message: "Drive not found" });
    }

    if (drive.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Only pending drives can be approved (current status: ${drive.status}).`,
      });
    }

    drive.status = "Open";
    drive.tpoFeedback = null;
    await drive.save();

    if (drive.recruiterId && drive.recruiterId._id) {
      await socketService.sendRealTimeNotification(drive.recruiterId._id, {
        title: "Job Drive Approved 🎉",
        message: `Your job drive "${drive.title}" has been approved by the TPO and is now live for students to apply!`,
        type: "success",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Drive approved successfully! Students can now apply.",
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve job drive",
      error: error.message,
    });
  }
};

const rejectDrive = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "A detailed rejection reason is required (minimum 10 characters).",
      });
    }

    const drive = await JobDrive.findById(id).populate("recruiterId");
    if (!drive) {
      return res.status(404).json({ success: false, message: "Drive not found" });
    }

    if (drive.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Only pending drives can be rejected (current status: ${drive.status}).`,
      });
    }

    drive.status = "Rejected";
    drive.tpoFeedback = reason.trim();
    await drive.save();

    if (drive.recruiterId && drive.recruiterId._id) {
      await socketService.sendRealTimeNotification(drive.recruiterId._id, {
        title: "Job Drive Rejected ❌",
        message: `Your job drive "${drive.title}" was rejected by TPO: ${reason.trim()}`,
        type: "error",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Drive rejected. Recruiter has been notified.",
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject job drive",
      error: error.message,
    });
  }
};

const holdDrive = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "A detailed feedback reason is required when putting a drive on hold (minimum 10 characters).",
      });
    }

    const drive = await JobDrive.findById(id).populate("recruiterId");
    if (!drive) {
      return res.status(404).json({ success: false, message: "Drive not found" });
    }

    if (drive.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Only pending drives can be placed on hold (current status: ${drive.status}).`,
      });
    }

    drive.status = "OnHold";
    drive.tpoFeedback = reason.trim();
    await drive.save();

    if (drive.recruiterId && drive.recruiterId._id) {
      await socketService.sendRealTimeNotification(drive.recruiterId._id, {
        title: "Job Drive Placed On Hold ⏸️",
        message: `Your job drive "${drive.title}" requires revisions. TPO Feedback: ${reason.trim()}`,
        type: "warning",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Drive placed on hold. Recruiter can edit and resubmit.",
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to place job drive on hold",
      error: error.message,
    });
  }
};

const getSeasonConfig = async (req, res) => {
  try {
    let config = await CollegeConfig.findOne()
      .populate("updatedBy", "name email")
      .sort({ updatedAt: -1 });

    if (!config) {
      const currentYear = new Date().getFullYear();
      config = await CollegeConfig.create({
        seasonStart: new Date(currentYear, 7, 1), // Aug 1
        seasonEnd: new Date(currentYear, 11, 15), // Dec 15
        updatedBy: req.user ? req.user._id : null,
        updatedAt: new Date(),
      });
      if (req.user && req.user._id) {
        config = await CollegeConfig.findById(config._id).populate("updatedBy", "name email");
      }
    }

    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch placement season configuration",
      error: error.message,
    });
  }
};

const updateSeasonConfig = async (req, res) => {
  try {
    const { seasonStart, seasonEnd } = req.body;

    if (!seasonStart || !seasonEnd) {
      return res.status(400).json({
        success: false,
        message: "Both seasonStart and seasonEnd are required",
      });
    }

    const startDate = new Date(seasonStart);
    const endDate = new Date(seasonEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format provided for season dates",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        message: "Placement season start date cannot be after season end date",
      });
    }

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays < 180) {
      return res.status(400).json({
        success: false,
        message: "Placement season duration must be at least 6 months (minimum 180 days).",
      });
    }

    if (diffDays > 366) {
      return res.status(400).json({
        success: false,
        message: "Placement season duration cannot exceed 1 year (maximum 365 days).",
      });
    }

    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = new CollegeConfig({
        seasonStart: startDate,
        seasonEnd: endDate,
        updatedBy: req.user ? req.user._id : null,
        updatedAt: new Date(),
      });
    } else {
      config.seasonStart = startDate;
      config.seasonEnd = endDate;
      config.updatedBy = req.user ? req.user._id : null;
      config.updatedAt = new Date();
    }

    await config.save();

    const populatedConfig = await CollegeConfig.findById(config._id).populate(
      "updatedBy",
      "name email"
    );

    return res.status(200).json({
      success: true,
      message: "Placement season configuration updated successfully",
      data: populatedConfig,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update placement season configuration",
      error: error.message,
    });
  }
};

// GET /api/tpo/student/:rollNumber/audit
const getStudentAuditDetails = async (req, res) => {
  try {
    const { rollNumber } = req.params;

    const student = await Student.findOne({ rollNumber: rollNumber.toString().trim() }).populate(
      "userId",
      "name email phone isActive"
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student with Roll Number "${rollNumber}" not found`,
      });
    }

    const applications = await Application.find({ studentId: student._id })
      .populate({
        path: "driveId",
        select: "title ctc location applicationDeadline recruiterId status",
        populate: {
          path: "recruiterId",
          select: "name email companyName",
        },
      })
      .sort({ createdAt: -1 });

    // Collect all recruiter userIds to map exact Recruiter profile details (companyName)
    const recruiterUserIds = applications
      .map((app) => app.driveId?.recruiterId?._id || app.driveId?.recruiterId)
      .filter(Boolean);

    const recruiterProfiles = await Recruiter.find({
      $or: [
        { userId: { $in: recruiterUserIds } },
        { _id: { $in: recruiterUserIds } },
      ],
    });

    const recruiterMap = new Map();
    recruiterProfiles.forEach((r) => {
      recruiterMap.set(r.userId.toString(), r);
      recruiterMap.set(r._id.toString(), r);
    });

    // Determine overall student status
    let overallStatus = "Not Applied";
    if (applications.length > 0) {
      const isPlaced = applications.some(
        (app) => app.status === "Placed" || app.status === "Offer Accepted" || app.offer?.status === "Accepted"
      );
      if (isPlaced) {
        overallStatus = "Placed";
      } else {
        const hasInProgress = applications.some(
          (app) => app.status !== "Rejected" && app.status !== "Withdrawn"
        );
        overallStatus = hasInProgress ? "In Progress" : "Not Placed";
      }
    }

    const formattedApplications = applications.map((app) => {
      const drive = app.driveId || {};
      const recUser = drive.recruiterId || {};
      const recUserIdStr = recUser._id ? recUser._id.toString() : recUser.toString ? recUser.toString() : null;
      const recProfile = recUserIdStr ? recruiterMap.get(recUserIdStr) : null;

      const companyName = recProfile?.companyName || recUser.companyName || recUser.name || "Campus Recruiter";
      const companyLogo = recProfile?.companyLogo || null;

      return {
        _id: app._id,
        driveTitle: drive.title || "Job Drive",
        companyName,
        companyLogo,
        ctc: drive.ctc ? drive.ctc.toLocaleString("en-IN") : "N/A",
        appliedDate: app.appliedAt || app.createdAt,
        status: app.status,
        aiMatchScore: app.aiMatchScore || 85,
        aptitude: {
          status: app.aptitude?.status || "Pending",
          score: app.aptitude?.score ?? null,
          testDate: app.aptitude?.testDate || null,
        },
        gd: {
          status: app.gd?.status || "Pending",
          score: app.gd?.score ?? null,
          gdDate: app.gd?.gdDate || null,
        },
        interview: {
          result: app.interview?.result || app.interview?.status || "Pending",
          feedback: app.interview?.feedback || null,
          scheduledDate: app.interview?.scheduledDate || null,
        },
        offer: {
          status: app.offer?.status || (app.status === "Placed" ? "Accepted" : "None"),
          acceptedAt: app.offer?.acceptedAt || null,
          ctcOffered: app.offer?.ctcOffered || drive.ctc,
          fileId: app.offer?.fileId || null,
          filePath: app.offer?.filePath || null,
        },
      };
    });

    const studentPhone = student.userId?.phone && student.userId.phone !== "N/A" && student.userId.phone.trim() !== "" 
      ? student.userId.phone 
      : null;

    return res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        rollNumber: student.rollNumber,
        name: student.userId?.name || "N/A",
        email: student.userId?.email || "N/A",
        phone: studentPhone,
        branch: student.branch,
        cgpa: student.cgpa,
        passoutYear: student.passoutYear,
        activeBacklogs: student.activeBacklogs,
        resumePath: student.resumePath,
        isProfileComplete: student.isProfileComplete,
      },
      overallStatus,
      applications: formattedApplications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student audit details",
      error: error.message,
    });
  }
};

// GET /api/tpo/college-config
const getCollegeConfig = async (req, res) => {
  try {
    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = await CollegeConfig.create({
        seasonStart: new Date(new Date().getFullYear(), 7, 1),
        seasonEnd: new Date(new Date().getFullYear(), 11, 15),
        branches: ['BCA', 'MCA', 'INMCA', 'ECE', 'CSE', 'IT', 'EEE', 'ME', 'CE', 'AD'],
        passoutYears: [2024, 2025, 2026, 2027, 2028],
      });
    }
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch college configuration",
      error: error.message,
    });
  }
};

// PUT /api/tpo/college-config
const updateCollegeConfig = async (req, res) => {
  try {
    const { branches, passoutYears, seasonStart, seasonEnd } = req.body;

    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = new CollegeConfig();
    }

    if (Array.isArray(branches)) {
      const cleanBranches = branches
        .map((b) => b.toString().trim().toUpperCase())
        .filter((b) => b.length > 0);
      config.branches = Array.from(new Set(cleanBranches));
    }

    if (Array.isArray(passoutYears)) {
      const cleanYears = passoutYears
        .map((y) => Number(y))
        .filter((y) => !isNaN(y) && y > 1990 && y < 2100);
      config.passoutYears = Array.from(new Set(cleanYears)).sort((a, b) => a - b);
    }

    if (seasonStart) config.seasonStart = new Date(seasonStart);
    if (seasonEnd) config.seasonEnd = new Date(seasonEnd);

    config.updatedBy = req.user ? req.user._id : null;
    config.updatedAt = new Date();

    await config.save();

    return res.status(200).json({
      success: true,
      message: "College configuration updated successfully",
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update college configuration",
      error: error.message,
    });
  }
};

// POST /api/tpo/college-config/branch
const addBranch = async (req, res) => {
  try {
    const { branch } = req.body;
    if (!branch || typeof branch !== "string" || !branch.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid branch name",
      });
    }

    const cleanBranch = branch.trim().toUpperCase();
    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = new CollegeConfig();
    }

    if (!config.branches.includes(cleanBranch)) {
      config.branches.push(cleanBranch);
      config.updatedBy = req.user ? req.user._id : null;
      config.updatedAt = new Date();
      await config.save();
    }

    return res.status(200).json({
      success: true,
      message: `Branch "${cleanBranch}" added successfully`,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add branch",
      error: error.message,
    });
  }
};

// DELETE /api/tpo/college-config/branch/:branch
const deleteBranch = async (req, res) => {
  try {
    const targetBranch = req.params.branch.trim().toUpperCase();

    // Check if branch is currently in use by any student
    const studentInBranch = await Student.findOne({ branch: { $regex: new RegExp(`^${targetBranch}$`, "i") } });
    if (studentInBranch) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch. Students are currently enrolled in this branch.`,
      });
    }

    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      return res.status(404).json({ success: false, message: "College configuration not found" });
    }

    config.branches = config.branches.filter((b) => b.toUpperCase() !== targetBranch);
    config.updatedBy = req.user ? req.user._id : null;
    config.updatedAt = new Date();
    await config.save();

    return res.status(200).json({
      success: true,
      message: `Branch "${targetBranch}" deleted successfully`,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete branch",
      error: error.message,
    });
  }
};

// POST /api/tpo/college-config/passout-year
const addPassoutYear = async (req, res) => {
  try {
    const { year } = req.body;
    const yearNum = Number(year);
    if (!yearNum || isNaN(yearNum) || yearNum < 1990 || yearNum > 2100) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 4-digit passout year",
      });
    }

    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = new CollegeConfig();
    }

    if (!config.passoutYears.includes(yearNum)) {
      config.passoutYears.push(yearNum);
      config.passoutYears.sort((a, b) => a - b);
      config.updatedBy = req.user ? req.user._id : null;
      config.updatedAt = new Date();
      await config.save();
    }

    return res.status(200).json({
      success: true,
      message: `Passout year ${yearNum} added successfully`,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add passout year",
      error: error.message,
    });
  }
};

// DELETE /api/tpo/college-config/passout-year/:year
const deletePassoutYear = async (req, res) => {
  try {
    const targetYear = Number(req.params.year);
    if (isNaN(targetYear)) {
      return res.status(400).json({ success: false, message: "Invalid passout year parameter" });
    }

    // Check if year is currently in use by any student
    const studentInYear = await Student.findOne({ passoutYear: targetYear });
    if (studentInYear) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete year. Students are currently graduating in this year.`,
      });
    }

    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      return res.status(404).json({ success: false, message: "College configuration not found" });
    }

    config.passoutYears = config.passoutYears.filter((y) => y !== targetYear);
    config.updatedBy = req.user ? req.user._id : null;
    config.updatedAt = new Date();
    await config.save();

    return res.status(200).json({
      success: true,
      message: `Passout year ${targetYear} deleted successfully`,
      data: config,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete passout year",
      error: error.message,
    });
  }
};

// GET /api/tpo/drives — All drives with company details and application metrics
const getAllDrivesForTPO = async (req, res) => {
  try {
    const drives = await JobDrive.find().sort({ createdAt: -1 });

    const drivesWithDetails = await Promise.all(
      drives.map(async (drive) => {
        const recruiter = await Recruiter.findOne({ userId: drive.recruiterId });
        const user = await User.findById(drive.recruiterId);
        const applicationCount = await Application.countDocuments({ driveId: drive._id });
        const placedCount = await Application.countDocuments({
          driveId: drive._id,
          $or: [{ status: "Placed" }, { "offer.status": "Accepted" }],
        });

        return {
          _id: drive._id,
          title: drive.title,
          description: drive.description,
          ctc: drive.ctc,
          minCGPA: drive.minCGPA,
          eligibleBranches: drive.eligibleBranches,
          maxBacklogs: drive.maxBacklogs,
          applicationDeadline: drive.applicationDeadline,
          hasAptitudeTest: drive.hasAptitudeTest,
          hasGD: drive.hasGD,
          status: drive.status,
          tpoFeedback: drive.tpoFeedback,
          createdAt: drive.createdAt,
          updatedAt: drive.updatedAt,
          recruiter: {
            _id: drive.recruiterId,
            companyName: recruiter?.companyName || user?.name || "Company",
            companyLogo: recruiter?.companyLogo || null,
            officialEmail: recruiter?.officialEmail || user?.email || "",
            website: recruiter?.website || "",
          },
          applicationCount,
          placedCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      drives: drivesWithDetails,
    });
  } catch (error) {
    console.error("Error in getAllDrivesForTPO:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch drives list",
      error: error.message,
    });
  }
};

// GET /api/tpo/drive/:driveId/applications — Detailed drill-down for Drive X-Ray
const getDriveApplicationsForTPO = async (req, res) => {
  try {
    const { driveId } = req.params;

    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Drive not found" });
    }

    const recruiter = await Recruiter.findOne({ userId: drive.recruiterId });
    const user = await User.findById(drive.recruiterId);

    const applications = await Application.find({ driveId })
      .populate({
        path: "studentId",
        populate: {
          path: "userId",
          select: "name email phone isActive",
        },
      })
      .sort({ aiMatchScore: -1, createdAt: -1 });

    let totalApplications = applications.length;
    let shortlisted = 0;
    let aptitudePassed = 0;
    let aptitudeFailed = 0;
    let gdShortlisted = 0;
    let gdRejected = 0;
    let interviewSelected = 0;
    let interviewRejected = 0;
    let placed = 0;

    const formattedApplications = applications.map((app) => {
      const studentObj = app.studentId;
      const userObj = studentObj?.userId;

      const statusLower = (app.status || "").toLowerCase();
      const aptStatus = app.aptitude?.status || "Not Applicable";
      const gdStatus = app.gd?.status || "Not Applicable";
      const intResult = app.interview?.result || "Pending";
      const offerStatus = app.offer?.status || "Not Sent";

      if (aptStatus === "Passed") aptitudePassed++;
      if (aptStatus === "Failed") aptitudeFailed++;

      if (gdStatus === "Shortlisted") gdShortlisted++;
      if (gdStatus === "Rejected") gdRejected++;

      if (intResult === "Selected") interviewSelected++;
      if (intResult === "Rejected") interviewRejected++;

      if (statusLower === "placed" || offerStatus === "Accepted") {
        placed++;
      }

      if (
        statusLower !== "applied" &&
        statusLower !== "rejected" &&
        statusLower !== "under review"
      ) {
        shortlisted++;
      }

      return {
        applicationId: app._id,
        appliedDate: app.appliedDate || app.createdAt,
        status: app.status,
        aiMatchScore: app.aiMatchScore,
        student: {
          _id: studentObj?._id,
          name: userObj?.name || "Unknown Student",
          email: userObj?.email || "",
          phone: userObj?.phone || "",
          rollNumber: studentObj?.rollNumber || "N/A",
          cgpa: studentObj?.cgpa || 0,
          branch: studentObj?.branch || "N/A",
          passoutYear: studentObj?.passoutYear || null,
          resumePath: studentObj?.resumePath || null,
          profilePicPath: studentObj?.profilePicPath || null,
        },
        aptitude: {
          status: app.aptitude?.status || "Not Applicable",
          score: app.aptitude?.score ?? null,
          feedback: app.aptitude?.feedback || null,
          markedAt: app.aptitude?.markedAt || null,
        },
        gd: {
          status: app.gd?.status || "Not Applicable",
          score: app.gd?.score ?? null,
          feedback: app.gd?.feedback || null,
          markedAt: app.gd?.markedAt || null,
        },
        interview: {
          status: app.interview?.status || "Pending",
          result: app.interview?.result || "Pending",
          score: app.interview?.score ?? null,
          feedback: app.interview?.feedback || null,
          markedAt: app.interview?.markedAt || null,
        },
        offer: {
          status: app.offer?.status || "Not Sent",
          fileId: app.offer?.fileId || null,
          filePath: app.offer?.filePath || null,
          fileName: app.offer?.fileName || null,
          uploadedDate: app.offer?.uploadedDate || null,
          acceptedAt: app.offer?.acceptedAt || null,
          declinedAt: app.offer?.declinedAt || null,
          declineReason: app.offer?.declineReason || null,
        },
        xai: {
          matchScore: app.xai?.matchScore ?? app.aiMatchScore ?? null,
          positiveSentences: app.xai?.positiveSentences || [],
          negativeSentences: app.xai?.negativeSentences || [],
          skillGaps: app.xai?.skillGaps || [],
          strongSkills: app.xai?.strongSkills || [],
          isOfflineFallback: app.xai?.isOfflineFallback || false,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        drive: {
          _id: drive._id,
          title: drive.title,
          description: drive.description,
          ctc: drive.ctc,
          minCGPA: drive.minCGPA,
          eligibleBranches: drive.eligibleBranches || [],
          maxBacklogs: drive.maxBacklogs,
          applicationDeadline: drive.applicationDeadline,
          hasAptitudeTest: drive.hasAptitudeTest,
          hasGD: drive.hasGD,
          status: drive.status,
          companyName: recruiter?.companyName || user?.name || "Company",
          companyLogo: recruiter?.companyLogo || null,
          officialEmail: recruiter?.officialEmail || user?.email || "",
          website: recruiter?.website || "",
          createdAt: drive.createdAt,
        },
        summary: {
          totalApplications,
          shortlisted,
          aptitudePassed,
          aptitudeFailed,
          gdShortlisted,
          gdRejected,
          interviewSelected,
          interviewRejected,
          placed,
        },
        applications: formattedApplications,
      },
    });
  } catch (error) {
    console.error("Error in getDriveApplicationsForTPO:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch drive applications",
      error: error.message,
    });
  }
};

// GET /api/tpo/schedules
const getAllSchedules = async (req, res) => {
  try {
    const { startDate, endDate, eventType, company } = req.query;

    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    const query = {
      date: { $gte: start, $lte: end },
      status: { $ne: "Cancelled" }
    };

    if (eventType && eventType !== "All" && eventType !== "ALL") {
      query.eventType = eventType;
    }

    const rawSchedules = await Schedule.find(query)
      .populate({
        path: "driveId",
        select: "title ctc location minCGPA recruiterId",
        populate: { path: "recruiterId", select: "companyName officialEmail companyLogo" }
      })
      .populate({
        path: "recruiterId",
        select: "companyName officialEmail companyLogo"
      })
      .populate({
        path: "studentId",
        select: "rollNumber branch cgpa passoutYear userId",
        populate: { path: "userId", select: "name email phone" }
      })
      .sort({ date: 1, timeSlot: 1 })
      .lean();

    const dateGroupsMap = new Map();
    let totalStudentsScheduled = 0;
    let totalSchedulesCount = 0;

    for (const item of rawSchedules) {
      if (!item.date) continue;

      const companyName = item.driveId?.recruiterId?.companyName || item.recruiterId?.companyName || "Company";
      const driveTitle = item.driveId?.title || "Job Drive";
      const studentName = item.studentId?.userId?.name || "Student";
      const studentRoll = item.studentId?.rollNumber || "N/A";
      const studentBranch = item.studentId?.branch || "N/A";
      const studentEmail = item.studentId?.userId?.email || "";
      const studentCgpa = item.studentId?.cgpa;

      if (company && company !== "All" && company !== "ALL") {
        const compTerm = company.toLowerCase().trim();
        const matchComp = companyName.toLowerCase().includes(compTerm) || driveTitle.toLowerCase().includes(compTerm);
        if (!matchComp) continue;
      }

      totalSchedulesCount++;
      totalStudentsScheduled++;

      const dateObj = new Date(item.date);
      const dateStr = dateObj.toISOString().split("T")[0];
      const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "long" });

      if (!dateGroupsMap.has(dateStr)) {
        dateGroupsMap.set(dateStr, {
          date: dateStr,
          dayOfWeek,
          slotsMap: new Map()
        });
      }

      const dateGroup = dateGroupsMap.get(dateStr);
      const slotKey = `${item.timeSlot}___${companyName}___${driveTitle}___${item.eventType}___${item.location || 'Online'}`;

      if (!dateGroup.slotsMap.has(slotKey)) {
        dateGroup.slotsMap.set(slotKey, {
          timeSlot: item.timeSlot,
          companyName,
          driveTitle,
          eventType: item.eventType,
          location: item.location || "Online",
          meetingUrl: item.meetingUrl || null,
          driveId: item.driveId?._id || null,
          studentCount: 0,
          students: []
        });
      }

      const slot = dateGroup.slotsMap.get(slotKey);
      slot.studentCount++;
      slot.students.push({
        _id: item.studentId?._id,
        name: studentName,
        rollNumber: studentRoll,
        branch: studentBranch,
        email: studentEmail,
        cgpa: studentCgpa
      });
    }

    const groupedSchedules = Array.from(dateGroupsMap.values()).map(dg => ({
      date: dg.date,
      dayOfWeek: dg.dayOfWeek,
      slots: Array.from(dg.slotsMap.values())
    }));

    return res.status(200).json({
      success: true,
      data: {
        dateRange: {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0]
        },
        totalSchedules: totalSchedulesCount,
        totalStudentsScheduled,
        groupedSchedules
      }
    });
  } catch (error) {
    console.error("Error in getAllSchedules:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch master schedules",
      error: error.message
    });
  }
};

// GET /api/tpo/schedules/summary
const getCalendarSummary = async (req, res) => {
  try {
    const now = new Date();
    
    // Week bounds (Mon-Sun)
    const day = now.getDay();
    const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diffToMon));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

    // Month bounds
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const activeSchedules = await Schedule.find({ status: { $ne: "Cancelled" } })
      .populate({
        path: "driveId",
        select: "title recruiterId",
        populate: { path: "recruiterId", select: "companyName" }
      })
      .populate({
        path: "recruiterId",
        select: "companyName"
      })
      .lean();

    let totalThisWeek = 0;
    let totalThisMonth = 0;
    const companyCountMap = {};
    const dayOfWeekCountMap = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    const dateClashMap = {};

    for (const item of activeSchedules) {
      if (!item.date) continue;
      const d = new Date(item.date);
      const companyName = item.driveId?.recruiterId?.companyName || item.recruiterId?.companyName || "Company";

      if (d >= startOfWeek && d <= endOfWeek) totalThisWeek++;
      if (d >= startOfMonth && d <= endOfMonth) totalThisMonth++;

      companyCountMap[companyName] = (companyCountMap[companyName] || 0) + 1;

      const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
      if (dayOfWeekCountMap[dayName] !== undefined) {
        dayOfWeekCountMap[dayName]++;
      }

      const dateStr = d.toISOString().split("T")[0];
      if (!dateClashMap[dateStr]) {
        dateClashMap[dateStr] = {
          date: dateStr,
          dayOfWeek: dayName,
          companies: new Set(),
          totalStudents: 0,
          events: []
        };
      }
      dateClashMap[dateStr].companies.add(companyName);
      dateClashMap[dateStr].totalStudents++;
      dateClashMap[dateStr].events.push({
        companyName,
        eventType: item.eventType,
        timeSlot: item.timeSlot
      });
    }

    let mostScheduledCompany = "N/A";
    let maxCompanyCount = 0;
    for (const [comp, count] of Object.entries(companyCountMap)) {
      if (count > maxCompanyCount) {
        maxCompanyCount = count;
        mostScheduledCompany = comp;
      }
    }

    let busiestDay = "Monday";
    let maxDayCount = -1;
    for (const [dName, count] of Object.entries(dayOfWeekCountMap)) {
      if (count > maxDayCount) {
        maxDayCount = count;
        busiestDay = dName;
      }
    }

    const clashesDetected = [];
    for (const [dateStr, info] of Object.entries(dateClashMap)) {
      if (info.companies.size > 1 || info.totalStudents > 50) {
        clashesDetected.push({
          date: dateStr,
          dayOfWeek: info.dayOfWeek,
          companyCount: info.companies.size,
          companies: Array.from(info.companies),
          totalStudents: info.totalStudents,
          warning: info.companies.size > 1 
            ? `Clash: ${Array.from(info.companies).join(" & ")} both scheduled on ${dateStr}`
            : `High volume overload: ${info.totalStudents} students scheduled on ${dateStr}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      summary: {
        totalThisWeek,
        totalThisMonth,
        totalStudentsScheduled: activeSchedules.length,
        mostScheduledCompany,
        busiestDay,
        clashesDetected
      }
    });
  } catch (error) {
    console.error("Error in getCalendarSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch calendar summary",
      error: error.message
    });
  }
};

// =========================================================================
// PLACEMENT READINESS ANALYZER (PRA) CONTROLLERS
// =========================================================================

// GET /api/tpo/analyzer/student/:rollNumber
const getStudentReadiness = async (req, res) => {
  try {
    const { rollNumber } = req.params;
    if (!rollNumber) {
      return res.status(400).json({ success: false, message: "Roll number is required" });
    }

    const student = await Student.findOne({ rollNumber: rollNumber.trim() });
    if (!student) {
      return res.status(404).json({ success: false, message: `Student with roll number ${rollNumber} not found` });
    }

    const individualPRA = await placementAnalyzerService.computeIndividualPRA(student._id);
    const departmentRadar = await placementAnalyzerService.getDepartmentRadarAverage(student.branch);

    return res.status(200).json({
      success: true,
      data: {
        ...individualPRA,
        departmentRadar,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to compute student readiness",
      error: error.message,
    });
  }
};

// GET /api/tpo/analyzer/department/:branch
const getDepartmentReadiness = async (req, res) => {
  try {
    const { branch } = req.params;
    const data = await placementAnalyzerService.computeDepartmentMetrics(branch);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to compute department readiness",
      error: error.message,
    });
  }
};

// GET /api/tpo/analyzer/overview
const getAllStudentsReadiness = async (req, res) => {
  try {
    const { branch, sort } = req.query;
    const data = await placementAnalyzerService.computeAllStudentsPRA(branch, sort);
    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student readiness overview",
      error: error.message,
    });
  }
};

module.exports = {
  getStudentsList,
  getDashboardAnalytics,
  getPlacementFunnel,
  getBranchWiseStats,
  getOfferAcceptanceTrends,
  getPendingRecruiters,
  getApprovedRecruiters,
  getOnHoldRecruiters,
  getRecruiterVerificationDetails,
  approveRecruiter,
  rejectRecruiter,
  putRecruiterOnHold,
  bulkImportStudents,
  addRecruiterSuggestion,
  toggleRecruiterStatus,
  reVerifyRecruiter,
  reverifyRecruiter,
  getPendingDrives,
  approveDrive,
  rejectDrive,
  holdDrive,
  getSeasonConfig,
  updateSeasonConfig,
  getStudentAuditDetails,
  getCollegeConfig,
  updateCollegeConfig,
  addBranch,
  deleteBranch,
  addPassoutYear,
  deletePassoutYear,
  getAllDrivesForTPO,
  getDriveApplicationsForTPO,
  getAllSchedules,
  getCalendarSummary,
  getStudentReadiness,
  getDepartmentReadiness,
  getAllStudentsReadiness,
};

