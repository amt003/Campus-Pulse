const User = require("../models/User");
const Student = require("../models/Student");
const Recruiter = require("../models/Recruiter");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const verificationService = require("../services/verificationService");
const socketService = require("../services/socketService");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../utils/emailTemplates");

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
    const studentList = Array.isArray(students) ? students : Array.isArray(req.body) ? req.body : null;

    if (!studentList || studentList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of students to import",
      });
    }

    const createdRecords = [];
    const errors = [];

    for (const [index, item] of studentList.entries()) {
      try {
        const { rollNumber, name, email, phone, cgpa, branch, passoutYear, activeBacklogs } = item;

        if (!name || !email || !rollNumber || cgpa === undefined || !branch || !passoutYear) {
          errors.push({ index, email: email || rollNumber, error: "Missing required fields" });
          continue;
        }

        // Check 1: Duplicate by email
        let user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          errors.push({ index, email, error: "User email already exists" });
          continue;
        }

        // Check 2: Duplicate by roll number (secondary guard)
        const existingStudent = await Student.findOne({ rollNumber: rollNumber.toString().trim() });
        if (existingStudent) {
          errors.push({ index, email, rollNumber, error: `Roll number "${rollNumber}" already exists in the system` });
          continue;
        }

        // 1. Set password for User to student's rollNumber (hashed securely by User model pre-save hook)
        user = await User.create({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: rollNumber.toString().trim(), // Default password is their roll number
          role: "Student",
          phone: phone ? phone.toString().trim() : "",
          isActive: true,
        });

        // 2. No activation email is sent
        // await sendWelcomeEmail(user.email, rollNumber);

        const student = await Student.create({
          userId: user._id,
          rollNumber: rollNumber.toString().trim(),
          cgpa: Number(cgpa),
          branch: branch.trim(),
          passoutYear: Number(passoutYear),
          activeBacklogs: Number(activeBacklogs || 0),
          isProfileComplete: true,
        });

        createdRecords.push({ userId: user._id, studentId: student._id, email: user.email, rollNumber: student.rollNumber });
      } catch (err) {
        errors.push({ index, email: item.email, error: err.message });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${createdRecords.length} students imported successfully. Default password is their roll number.`,
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
          "verificationDetails.whoisData.domain": verification.whoisData.domain,
          "verificationDetails.whoisData.creationDate": verification.whoisData.creationDate,
          "verificationDetails.whoisData.domainAgeYears": verification.whoisData.domainAgeYears,
          "verificationDetails.whoisData.registrar": verification.whoisData.registrar,
          "verificationDetails.whoisData.registrantCountry": verification.whoisData.registrantCountry,
          "verificationDetails.whoisData.isValid": verification.whoisData.isValid,
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
};

