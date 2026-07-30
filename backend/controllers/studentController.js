const Student = require("../models/Student");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");

const createStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "Student") {
      return res.status(403).json({
        message: "Only students can create a student profile",
      });
    }

    const existingProfile = await Student.findOne({ userId: req.user._id });
    if (existingProfile) {
      return res.status(409).json({
        message: "Student profile already exists",
      });
    }

    const {
      rollNumber,
      cgpa,
      branch,
      passoutYear,
      activeBacklogs,
      resumePath,
    } = req.body;

    if (!rollNumber || cgpa === undefined || !branch || !passoutYear) {
      return res.status(400).json({
        message: "rollNumber, cgpa, branch, and passoutYear are required",
      });
    }

    const studentProfile = await Student.create({
      userId: req.user._id,
      rollNumber,
      cgpa,
      branch,
      passoutYear,
      activeBacklogs,
      resumePath,
      isProfileComplete: true,
    });

    return res.status(201).json({
      message: "Student profile created successfully",
      profile: studentProfile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create student profile",
      error: error.message,
    });
  }
};

const getStudentProfile = async (req, res) => {
  try {
    const profile = await Student.findOne({ userId: req.user._id }).populate(
      "userId",
      "name email role phone isActive"
    );

    if (!profile) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    return res.status(200).json({
      profile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch student profile",
      error: error.message,
    });
  }
};

const updateStudentProfile = async (req, res) => {
  try {
    const profile = await Student.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    const allowedFields = [
      "rollNumber",
      "cgpa",
      "branch",
      "passoutYear",
      "activeBacklogs",
      "resumePath",
      "isProfileComplete",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field];
      }
    });

    await profile.save();

    return res.status(200).json({
      message: "Student profile updated successfully",
      profile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to update student profile",
      error: error.message,
    });
  }
};

const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload a resume file",
      });
    }

    const profile = await Student.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    profile.resumePath = `/uploads/resumes/${req.file.filename}`;
    profile.isProfileComplete = true;
    await profile.save();

    return res.status(200).json({
      message: "Resume uploaded successfully",
      resumePath: profile.resumePath,
      profile,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to upload resume",
      error: error.message,
    });
  }
};

const getEligibleDrives = async (req, res) => {
  try {
    const profile = await Student.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    const currentDate = new Date();
    const drives = await JobDrive.find({
      status: "Open",
      applicationDeadline: { $gte: currentDate },
      minCGPA: { $lte: profile.cgpa },
      maxBacklogs: { $gte: profile.activeBacklogs },
      $or: [
        { eligibleBranches: { $size: 0 } },
        { eligibleBranches: profile.branch },
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      drives,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch eligible drives",
      error: error.message,
    });
  }
};

const applyToDrive = async (req, res) => {
  try {
    const profile = await Student.findOne({ userId: req.user._id });

    if (!profile) {
      return res.status(404).json({
        message: "Student profile not found",
      });
    }

    const drive = await JobDrive.findById(req.params.driveId);

    if (!drive) {
      return res.status(404).json({
        message: "Job drive not found",
      });
    }

    if (drive.status !== "Open") {
      return res.status(400).json({
        message: "This drive is not open for applications",
      });
    }

    if (new Date(drive.applicationDeadline) < new Date()) {
      return res.status(400).json({
        message: "Application deadline has passed",
      });
    }

    if (profile.cgpa < drive.minCGPA) {
      return res.status(400).json({
        message: "You do not meet the minimum CGPA requirement",
      });
    }

    if (profile.activeBacklogs > drive.maxBacklogs) {
      return res.status(400).json({
        message: "You do not meet the backlog requirement",
      });
    }

    if (
      Array.isArray(drive.eligibleBranches) &&
      drive.eligibleBranches.length > 0 &&
      !drive.eligibleBranches.includes(profile.branch)
    ) {
      return res.status(400).json({
        message: "Your branch is not eligible for this drive",
      });
    }

    const existingApplication = await Application.findOne({
      studentId: profile._id,
      driveId: drive._id,
    });

    if (existingApplication) {
      return res.status(409).json({
        message: "You have already applied to this drive",
      });
    }

    const application = await Application.create({
      studentId: profile._id,
      driveId: drive._id,
    });

    return res.status(201).json({
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to apply to drive",
      error: error.message,
    });
  }
};

// GET /api/student/applications
const getStudentApplications = async (req, res) => {
  try {
    const profile = await Student.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const applications = await Application.find({ studentId: profile._id })
      .populate("driveId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      applications,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch student applications",
      error: error.message,
    });
  }
};

// GET /api/student/application/:id
const getApplicationById = async (req, res) => {
  try {
    const profile = await Student.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      studentId: profile._id,
    }).populate("driveId");

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const schedules = await Schedule.find({
      applicationId: application._id,
    }).sort({ date: 1 });

    return res.status(200).json({
      application,
      schedules,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch application details",
      error: error.message,
    });
  }
};

module.exports = {
  createStudentProfile,
  getStudentProfile,
  updateStudentProfile,
  uploadResume,
  getEligibleDrives,
  applyToDrive,
  getStudentApplications,
  getApplicationById,
};
