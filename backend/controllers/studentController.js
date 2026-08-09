const Student = require("../models/Student");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");
const User = require("../models/User");
const Recruiter = require("../models/Recruiter");
const aiService = require("../services/aiService");

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
      "profilePicPath",
      "isProfileComplete",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        profile[field] = req.body[field] === "null" || req.body[field] === "" ? null : req.body[field];
      }
    });

    if (req.file) {
      profile.profilePicPath = `/uploads/logos/${req.file.filename}`;
    }

    await profile.save();

    // Check if password change is requested
    if (req.body.password && req.body.password.trim()) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.password = req.body.password.trim();
        await user.save();
      }
    }

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

    const recruiters = await Recruiter.find({});
    const recruiterMap = {};
    recruiters.forEach(r => {
      recruiterMap[r.userId.toString()] = {
        companyName: r.companyName,
        companyLogo: r.companyLogo
      };
    });

    const drivesWithCompany = drives.map(d => {
      const rec = recruiterMap[d.recruiterId.toString()] || { companyName: "Placement Recruiter", companyLogo: null };
      return {
        ...d.toObject(),
        companyName: rec.companyName,
        companyLogo: rec.companyLogo
      };
    });

    return res.status(200).json({
      drives: drivesWithCompany,
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

    const scoreResult = await aiService.scoreResume(profile.resumePath, drive.description);

    const application = await Application.create({
      studentId: profile._id,
      driveId: drive._id,
      aiMatchScore: scoreResult.matchScore,
      xai: {
        matchScore: scoreResult.matchScore,
        positiveSentences: scoreResult.positiveSentences || [],
        negativeSentences: scoreResult.negativeSentences || [],
        skillGaps: scoreResult.skillGaps || [],
        strongSkills: scoreResult.strongSkills || [],
        isOfflineFallback: scoreResult.isOfflineFallback || false
      }
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

    const recruiters = await Recruiter.find({});
    const recruiterMap = {};
    recruiters.forEach(r => {
      recruiterMap[r.userId.toString()] = {
        companyName: r.companyName,
        companyLogo: r.companyLogo
      };
    });

    const appsWithCompany = applications.map(app => {
      const appObj = app.toObject();
      if (appObj.driveId) {
        const rec = recruiterMap[appObj.driveId.recruiterId.toString()] || { companyName: "Placement Recruiter", companyLogo: null };
        appObj.driveId.companyName = rec.companyName;
        appObj.driveId.companyLogo = rec.companyLogo;
      }
      return appObj;
    });

    return res.status(200).json({
      applications: appsWithCompany,
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

    const rec = await Recruiter.findOne({ userId: application.driveId.recruiterId });
    const appObj = application.toObject();
    if (appObj.driveId) {
      appObj.driveId.companyName = rec ? rec.companyName : "Placement Recruiter";
      appObj.driveId.companyLogo = rec ? rec.companyLogo : null;
    }

    const schedules = await Schedule.find({
      applicationId: application._id,
    }).sort({ date: 1 });

    return res.status(200).json({
      application: appObj,
      schedules,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch application details",
      error: error.message,
    });
  }
};

// GET /api/student/schedule
const getStudentSchedule = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const rawSchedules = await Schedule.find({ studentId: student._id })
      .populate({
        path: "driveId",
        select: "title recruiterId companyName",
      })
      .sort({ date: 1 });

    const formattedSchedules = await Promise.all(
      rawSchedules.map(async (sch) => {
        let companyName = "Campus Recruiter";
        if (sch.driveId) {
          if (sch.driveId.companyName) {
            companyName = sch.driveId.companyName;
          } else if (sch.driveId.recruiterId) {
            const rec = await Recruiter.findOne({ userId: sch.driveId.recruiterId });
            if (rec) companyName = rec.companyName;
          }
        }

        return {
          scheduleId: sch._id,
          _id: sch._id,
          eventType: sch.eventType,
          date: sch.date,
          timeSlot: sch.timeSlot,
          location: sch.location,
          meetingUrl: sch.meetingUrl,
          status: sch.status,
          drive: {
            title: sch.driveId ? sch.driveId.title : "Placement Drive",
            companyName,
          },
          driveTitle: sch.driveId ? sch.driveId.title : "Placement Drive",
          companyName,
        };
      })
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];

    for (const item of formattedSchedules) {
      const schDate = new Date(item.date);
      schDate.setHours(0, 0, 0, 0);

      if (schDate >= today && item.status !== "Completed") {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        upcoming,
        past,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student schedules",
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
  getStudentSchedule,
};
