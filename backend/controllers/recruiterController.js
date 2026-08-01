const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");
const Recruiter = require("../models/Recruiter");
const User = require("../models/User");

const ALL_STATUSES = [
  "Applied",
  "Under Review",
  "Aptitude Scheduled",
  "Aptitude Completed",
  "GD Scheduled",
  "GD Completed",
  "Interview Scheduled",
  "Interview Completed",
  "Selected",
  "Rejected",
  "Waitlisted",
  "Offer Sent",
  "Offer Accepted",
  "Offer Declined",
  "Placed",
];

// Phase 2: GET /api/recruiter/profile
const getRecruiterProfile = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id }).populate(
      "userId",
      "name email phone isActive"
    );

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        recruiterId: recruiter._id,
        companyName: recruiter.companyName,
        officialEmail: recruiter.officialEmail,
        website: recruiter.website,
        companyLogo: recruiter.companyLogo,
        isApproved: recruiter.isApproved,
        trustScore: recruiter.trustScore || 85,
        tpoSuggestions: recruiter.tpoSuggestions || [],
        user: {
          name: recruiter.userId ? recruiter.userId.name : req.user.name,
          email: recruiter.userId ? recruiter.userId.email : req.user.email,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recruiter profile",
      error: error.message,
    });
  }
};

const getDriveApplications = async (req, res) => {
  try {
    const drive = await JobDrive.findOne({
      _id: req.params.driveId,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Job drive not found",
      });
    }

    const applications = await Application.find({ driveId: drive._id })
      .populate({
        path: "studentId",
        populate: {
          path: "userId",
          select: "name email phone role isActive",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      drive,
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch drive applications",
      error: error.message,
    });
  }
};

const updateApplicationStatus = async (req, res) => {
  try {
    const { status, aiMatchScore } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "status is required",
      });
    }

    if (!ALL_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid application status. Allowed statuses: ${ALL_STATUSES.join(", ")}`,
      });
    }

    const application = await Application.findById(
      req.params.applicationId
    ).populate({
      path: "studentId",
      populate: {
        path: "userId",
        select: "name email phone role isActive",
      },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const drive = await JobDrive.findOne({
      _id: application.driveId,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this application",
      });
    }

    application.status = status;

    if (aiMatchScore !== undefined) {
      application.aiMatchScore = aiMatchScore;
    }

    await application.save();

    return res.status(200).json({
      success: true,
      message: "Application updated successfully",
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update application status",
      error: error.message,
    });
  }
};

const createJobDrive = async (req, res) => {
  try {
    const {
      title,
      description,
      ctc,
      minCGPA,
      eligibleBranches,
      maxBacklogs,
      applicationDeadline,
      hasAptitudeTest,
      hasGD,
      status,
    } = req.body;

    if (
      !title ||
      !description ||
      ctc === undefined ||
      minCGPA === undefined ||
      !applicationDeadline
    ) {
      return res.status(400).json({
        success: false,
        message:
          "title, description, ctc, minCGPA, and applicationDeadline are required",
      });
    }

    const jobDrive = await JobDrive.create({
      recruiterId: req.user._id,
      title,
      description,
      ctc,
      minCGPA,
      eligibleBranches: Array.isArray(eligibleBranches) ? eligibleBranches : [],
      maxBacklogs: maxBacklogs ?? 0,
      applicationDeadline,
      hasAptitudeTest: Boolean(hasAptitudeTest),
      hasGD: Boolean(hasGD),
      status: status || "Draft",
    });

    return res.status(201).json({
      success: true,
      message: "Job drive created successfully",
      drive: jobDrive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create job drive",
      error: error.message,
    });
  }
};

const getRecruiterDrives = async (req, res) => {
  try {
    const drives = await JobDrive.find({ recruiterId: req.user._id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      drives,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job drives",
      error: error.message,
    });
  }
};

const getJobDriveById = async (req, res) => {
  try {
    const drive = await JobDrive.findOne({
      _id: req.params.id,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Job drive not found",
      });
    }

    return res.status(200).json({
      success: true,
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job drive",
      error: error.message,
    });
  }
};

const updateJobDrive = async (req, res) => {
  try {
    const drive = await JobDrive.findOne({
      _id: req.params.id,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Job drive not found",
      });
    }

    const allowedFields = [
      "title",
      "description",
      "ctc",
      "minCGPA",
      "eligibleBranches",
      "maxBacklogs",
      "applicationDeadline",
      "hasAptitudeTest",
      "hasGD",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        drive[field] = req.body[field];
      }
    });

    await drive.save();

    return res.status(200).json({
      success: true,
      message: "Job drive updated successfully",
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update job drive",
      error: error.message,
    });
  }
};

const closeJobDrive = async (req, res) => {
  try {
    const drive = await JobDrive.findOne({
      _id: req.params.id,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Job drive not found",
      });
    }

    drive.status = "Closed";
    await drive.save();

    return res.status(200).json({
      success: true,
      message: "Job drive closed successfully",
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to close job drive",
      error: error.message,
    });
  }
};

// PUT /api/recruiter/result/aptitude
const markAptitudeResult = async (req, res) => {
  try {
    const { applicationId, status, score, testLink } = req.body;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    application.aptitude.status = status || "Completed";
    if (score !== undefined) application.aptitude.score = score;
    if (testLink !== undefined) application.aptitude.testLink = testLink;
    application.aptitude.markedBy = req.user._id;
    application.aptitude.markedAt = new Date();
    application.status = status === "Passed" ? "Aptitude Completed" : application.status;

    await application.save();
    return res.status(200).json({ success: true, message: "Aptitude result updated", application });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update Aptitude result", error: error.message });
  }
};

// PUT /api/recruiter/result/gd
const markGDResult = async (req, res) => {
  try {
    const { applicationId, status } = req.body;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    application.gd.status = status || "Completed";
    application.gd.markedBy = req.user._id;
    application.gd.markedAt = new Date();
    application.status = status === "Shortlisted" ? "GD Completed" : application.status;

    await application.save();
    return res.status(200).json({ success: true, message: "GD result updated", application });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update GD result", error: error.message });
  }
};

// PUT /api/recruiter/result/interview
const markInterviewResult = async (req, res) => {
  try {
    const { applicationId, result, feedback } = req.body;

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    application.interview.status = "Completed";
    if (result) application.interview.result = result;
    if (feedback) application.interview.feedback = feedback;
    application.interview.markedBy = req.user._id;
    application.interview.markedAt = new Date();
    if (result === "Selected") application.status = "Selected";
    else if (result === "Rejected") application.status = "Rejected";

    await application.save();
    return res.status(200).json({ success: true, message: "Interview result updated", application });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update Interview result", error: error.message });
  }
};

// POST /api/recruiter/schedule/:driveId
const scheduleStage = async (req, res) => {
  try {
    const { driveId } = req.params;
    const { studentIds, eventType, date, timeSlot, location } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0 || !eventType || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "studentIds (array), eventType, date, and timeSlot are required",
      });
    }

    const drive = await JobDrive.findOne({
      _id: driveId,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(404).json({ success: false, message: "Job drive not found" });
    }

    const scheduledDate = new Date(date);

    // Conflict Detection Engine
    const conflicts = [];
    const createdSchedules = [];

    for (const studentId of studentIds) {
      const existingSchedule = await Schedule.findOne({
        studentId,
        date: scheduledDate,
        timeSlot,
        status: "Scheduled",
      }).populate("driveId", "title");

      if (existingSchedule) {
        conflicts.push({
          studentId,
          conflictingDrive: existingSchedule.driveId ? existingSchedule.driveId.title : "Other Drive",
          eventType: existingSchedule.eventType,
          timeSlot: existingSchedule.timeSlot,
        });
      }
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Schedule conflict detected for one or more students",
        conflictsCount: conflicts.length,
        conflicts,
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    // No conflicts detected — proceed to schedule
    for (const studentId of studentIds) {
      const application = await Application.findOne({ studentId, driveId: drive._id });

      if (application) {
        const newSchedule = await Schedule.create({
          studentId,
          recruiterId: recruiter ? recruiter._id : req.user._id,
          driveId: drive._id,
          applicationId: application._id,
          eventType,
          date: scheduledDate,
          timeSlot,
          location: location || "Online",
          status: "Scheduled",
        });

        createdSchedules.push(newSchedule);

        if (eventType === "Aptitude") {
          application.aptitude.status = "Scheduled";
          application.aptitude.scheduledDate = scheduledDate;
          application.status = "Aptitude Scheduled";
        } else if (eventType === "GD") {
          application.gd.status = "Scheduled";
          application.gd.scheduledDate = scheduledDate;
          application.status = "GD Scheduled";
        } else if (eventType === "Interview") {
          application.interview.status = "Scheduled";
          application.interview.scheduledDate = scheduledDate;
          application.interview.timeSlot = timeSlot;
          application.status = "Interview Scheduled";
        }

        await application.save();
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully scheduled ${eventType} for ${createdSchedules.length} candidate(s)`,
      scheduledCount: createdSchedules.length,
      schedules: createdSchedules,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to schedule event",
      error: error.message,
    });
  }
};

const updateRecruiterProfile = async (req, res) => {
  try {
    const { officialEmail, website, password } = req.body;
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (officialEmail) {
      const emailLower = officialEmail.toLowerCase().trim();
      const existingUser = await User.findOne({ email: emailLower, _id: { $ne: req.user._id } });
      const existingRecruiter = await Recruiter.findOne({ officialEmail: emailLower, _id: { $ne: recruiter._id } });
      if (existingUser || existingRecruiter) {
        return res.status(400).json({
          success: false,
          message: "A user or recruiter with this official email already exists",
        });
      }
      recruiter.officialEmail = emailLower;
      user.email = emailLower;
    }

    if (website !== undefined) {
      recruiter.website = website.trim() || null;
    }

    if (req.file) {
      recruiter.companyLogo = `/uploads/logos/${req.file.filename}`;
    }

    if (password && password.trim()) {
      user.password = password;
    }

    await recruiter.save();
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      recruiter: {
        id: recruiter._id,
        companyName: recruiter.companyName,
        officialEmail: recruiter.officialEmail,
        website: recruiter.website,
        companyLogo: recruiter.companyLogo,
        isApproved: recruiter.isApproved,
        status: recruiter.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update company profile",
      error: error.message,
    });
  }
};

module.exports = {
  getRecruiterProfile,
  getDriveApplications,
  updateApplicationStatus,
  createJobDrive,
  getRecruiterDrives,
  getJobDriveById,
  updateJobDrive,
  closeJobDrive,
  markAptitudeResult,
  markGDResult,
  markInterviewResult,
  scheduleStage,
  updateRecruiterProfile,
};
