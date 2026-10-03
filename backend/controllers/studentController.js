const Student = require("../models/Student");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");
const User = require("../models/User");
const Recruiter = require("../models/Recruiter");
const CollegeConfig = require("../models/CollegeConfig");
const aiService = require("../services/aiService");
const socketService = require("../services/socketService");
const { getStudentPlacementStatus } = require("../utils/studentStatus");
const placementAnalyzerService = require("../services/placementAnalyzerService");
const { parseTimeSlotWindow, evaluateScheduleStatus } = require("../utils/scheduleTimeHelper");

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
      contactNumber,
      phone,
      address,
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

    const contact = (contactNumber || phone || "").toString().trim();
    const studentAddress = (address || "").toString().trim();

    const studentProfile = await Student.create({
      userId: req.user._id,
      rollNumber,
      contactNumber: contact,
      address: studentAddress,
      cgpa,
      branch,
      passoutYear,
      activeBacklogs,
      resumePath,
      isProfileComplete: true,
    });

    if (contact) {
      await User.findByIdAndUpdate(req.user._id, { phone: contact });
    }

    const populatedProfile = await Student.findById(studentProfile._id).populate(
      "userId",
      "name email role phone isActive"
    );

    return res.status(201).json({
      message: "Student profile created successfully",
      profile: populatedProfile || studentProfile,
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

    const profileObj = profile.toObject();
    if (!profileObj.contactNumber && profileObj.userId && profileObj.userId.phone) {
      profileObj.contactNumber = profileObj.userId.phone;
    }

    return res.status(200).json({
      profile: profileObj,
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
      "contactNumber",
      "address",
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
        profile[field] = req.body[field] === "null" || req.body[field] === "" ? "" : req.body[field];
      }
    });

    if (req.body.phone !== undefined && req.body.contactNumber === undefined) {
      profile.contactNumber = req.body.phone === "null" || req.body.phone === "" ? "" : req.body.phone;
    }

    if (req.file) {
      profile.profilePicPath = `/uploads/logos/${req.file.filename}`;
    }

    await profile.save();

    const updatedPhone = req.body.contactNumber !== undefined ? req.body.contactNumber : req.body.phone;
    if (updatedPhone !== undefined) {
      await User.findByIdAndUpdate(req.user._id, { phone: updatedPhone });
    }

    // Check if password change is requested
    if (req.body.password && req.body.password.trim()) {
      const user = await User.findById(req.user._id);
      if (user) {
        user.password = req.body.password.trim();
        await user.save();
      }
    }

    const populatedProfile = await Student.findById(profile._id).populate(
      "userId",
      "name email role phone isActive"
    );

    const profileObj = populatedProfile ? populatedProfile.toObject() : profile.toObject();
    if (!profileObj.contactNumber && profileObj.userId && profileObj.userId.phone) {
      profileObj.contactNumber = profileObj.userId.phone;
    }

    return res.status(200).json({
      message: "Student profile updated successfully",
      profile: profileObj,
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

    // Automatically re-score active/pending applications for open drives in background
    try {
      const activeApplications = await Application.find({
        studentId: profile._id,
        status: { $in: ["Applied", "Under Review", "Aptitude Scheduled"] },
      }).populate("driveId");

      for (const app of activeApplications) {
        if (app.driveId && app.driveId.status === "Open" && app.driveId.description) {
          aiService
            .scoreResume(profile.resumePath, app.driveId.description)
            .then((scoreResult) => {
              app.aiMatchScore = scoreResult.matchScore;
              app.xai = {
                matchScore: scoreResult.matchScore,
                positiveSentences: scoreResult.positiveSentences || [],
                negativeSentences: scoreResult.negativeSentences || [],
                skillGaps: placementAnalyzerService.extractCleanSkills(scoreResult.skillGaps || []),
                strongSkills: scoreResult.strongSkills || [],
                isOfflineFallback: scoreResult.isOfflineFallback || false,
              };
              app.save().catch((err) => console.error("Error updating application score:", err.message));
            })
            .catch((err) => console.error("Error re-scoring application:", err.message));
        }
      }
    } catch (reScoreErr) {
      console.warn("Could not re-score existing applications:", reScoreErr.message);
    }

    return res.status(200).json({
      message: "Resume uploaded successfully. Active applications have been updated with your new resume.",
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

    // 2. CRITICAL CHECK: Check if student is already placed or accepted an offer
    const placedApplication = await Application.findOne({
      studentId: profile._id,
      $or: [
        { status: { $in: ["Placed", "Offer Accepted"] } },
        { "offer.status": "Accepted" },
      ],
    });

    if (profile.isPlaced || placedApplication) {
      return res.status(403).json({
        success: false,
        message: "You have already been placed. You cannot apply to other drives.",
      });
    }

    const currentDate = new Date();
    // Auto-expire open drives whose deadline has passed
    await JobDrive.updateMany(
      { status: "Open", applicationDeadline: { $lt: currentDate } },
      { $set: { status: "Expired" } }
    );

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

    // 1. PLACEMENT CHECK (Critical Safeguard)
    const placedApplication = await Application.findOne({
      studentId: profile._id,
      $or: [
        { status: { $in: ["Placed", "Offer Accepted"] } },
        { "offer.status": "Accepted" },
      ],
    });

    if (profile.isPlaced || placedApplication) {
      return res.status(403).json({
        success: false,
        message: "You are already placed. Cannot apply to new drives.",
      });
    }

    const drive = await JobDrive.findById(req.params.driveId);

    if (!drive) {
      return res.status(404).json({
        message: "Job drive not found",
      });
    }

    if (drive.status !== "Open" || new Date(drive.applicationDeadline) < new Date()) {
      if (new Date(drive.applicationDeadline) < new Date() && drive.status === "Open") {
        drive.status = "Expired";
        await drive.save();
      }
      return res.status(400).json({
        message: "This drive is not open for applications or the deadline has expired",
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
        skillGaps: placementAnalyzerService.extractCleanSkills(scoreResult.skillGaps || []),
        strongSkills: scoreResult.strongSkills || [],
        isOfflineFallback: scoreResult.isOfflineFallback || false
      }
    });

    // Check if an active Aptitude Test is already published for this drive
    const AptitudeTest = require("../models/AptitudeTest");
    const Notification = require("../models/Notification");
    const activeAptitudeTest = await AptitudeTest.findOne({
      driveId: drive._id,
      status: "Active",
    });

    if (activeAptitudeTest) {
      application.status = "Aptitude Scheduled";
      if (!application.aptitude) {
        application.aptitude = {};
      }
      application.aptitude.status = "Scheduled";
      application.aptitude.source = "in_house";
      await application.save();

      const scheduledDate = activeAptitudeTest.scheduledDate || new Date();
      const timeSlot = activeAptitudeTest.timeSlot || "10:00 AM - 11:00 AM";

      await Schedule.create({
        studentId: profile._id,
        recruiterId: activeAptitudeTest.recruiterId,
        driveId: drive._id,
        applicationId: application._id,
        eventType: "Aptitude",
        date: scheduledDate,
        timeSlot,
        location: "Online - CampusPulse",
        status: "Scheduled",
      });

      const dateStr = new Date(scheduledDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const notifMsg = `You have been scheduled for the Aptitude Test for ${drive.title} on ${dateStr} at ${timeSlot}.`;

      await Notification.create({
        userId: req.user._id,
        title: "Aptitude Test Scheduled",
        message: notifMsg,
        type: "info",
        read: false,
      });

      socketService.sendRealTimeNotification(req.user._id, {
        title: "Aptitude Test Scheduled",
        message: notifMsg,
        type: "info",
      });
    }

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

    // Auto-expire open drives whose deadline has passed
    await JobDrive.updateMany(
      { status: "Open", applicationDeadline: { $lt: new Date() } },
      { $set: { status: "Expired" } }
    );

    const placementStatus = await getStudentPlacementStatus(profile._id);

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
      if (appObj.xai && appObj.xai.skillGaps) {
        appObj.xai.skillGaps = placementAnalyzerService.extractCleanSkills(appObj.xai.skillGaps);
      }
      return appObj;
    });

    return res.status(200).json({
      success: true,
      applications: appsWithCompany,
      isPlaced: profile.isPlaced || placementStatus.isPlaced,
      placedCompany: placementStatus.companyName,
      placedDriveTitle: placementStatus.driveTitle,
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
    if (appObj.xai && appObj.xai.skillGaps) {
      appObj.xai.skillGaps = placementAnalyzerService.extractCleanSkills(appObj.xai.skillGaps);
    }

    const rawSchedules = await Schedule.find({
      applicationId: application._id,
    }).sort({ date: 1 });

    const now = new Date();
    const schedules = await Promise.all(
      rawSchedules.map(async (sch) => {
        let isDone = sch.status === "Completed";
        if (!isDone) {
          if (sch.eventType === "Aptitude" && (appObj.aptitude?.status === "Passed" || appObj.aptitude?.status === "Failed" || (appObj.aptitude?.score !== null && appObj.aptitude?.score !== undefined) || appObj.status === "Aptitude Completed")) {
            isDone = true;
          } else if (sch.eventType === "GD" && (appObj.gd?.status === "Shortlisted" || appObj.gd?.status === "Rejected" || appObj.gd?.status === "Completed" || appObj.status === "GD Completed")) {
            isDone = true;
          } else if (sch.eventType === "Interview" && (appObj.interview?.result === "Selected" || appObj.interview?.result === "Rejected" || appObj.interview?.result === "Waitlisted" || appObj.status === "Interview Completed")) {
            isDone = true;
          }

          if (isDone) {
            sch.status = "Completed";
            await Schedule.findByIdAndUpdate(sch._id, { status: "Completed" });
          }
        }

        const schObj = sch.toObject();
        if (schObj.status !== "Completed" && schObj.status !== "Cancelled") {
          const { startTime, endTime } = parseTimeSlotWindow(sch.date, sch.timeSlot);
          if (endTime && now > endTime) {
            schObj.status = "Missed";
          } else if (startTime && endTime && now >= startTime && now <= endTime) {
            schObj.status = "Active";
          }
        }
        return schObj;
      })
    );

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

    const placementStatus = await getStudentPlacementStatus(student._id);
    const isPlaced = student.isPlaced || placementStatus.isPlaced;
    const now = new Date();

    const rawSchedules = await Schedule.find({ studentId: student._id })
      .populate({
        path: "driveId",
        select: "title recruiterId companyName",
      })
      .populate("applicationId")
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

        let schStatus = sch.status;
        const app = sch.applicationId;

        let isFrozen = false;
        if (isPlaced && app && app.status !== "Placed" && app.status !== "Offer Accepted" && app.offer?.status !== "Accepted") {
          isFrozen = true;
        }

        if (app && schStatus !== "Completed") {
          if (sch.eventType === "Aptitude" && (app.aptitude?.status === "Passed" || app.aptitude?.status === "Failed" || (app.aptitude?.score !== null && app.aptitude?.score !== undefined) || app.status === "Aptitude Completed")) {
            schStatus = "Completed";
            await Schedule.findByIdAndUpdate(sch._id, { status: "Completed" });
          } else if (sch.eventType === "GD" && (app.gd?.status === "Shortlisted" || app.gd?.status === "Rejected" || app.gd?.status === "Completed" || app.status === "GD Completed")) {
            schStatus = "Completed";
            await Schedule.findByIdAndUpdate(sch._id, { status: "Completed" });
          } else if (sch.eventType === "Interview" && (app.interview?.result === "Selected" || app.interview?.result === "Rejected" || app.interview?.result === "Waitlisted" || app.status === "Interview Completed")) {
            schStatus = "Completed";
            await Schedule.findByIdAndUpdate(sch._id, { status: "Completed" });
          }
        }

        const { startTime, endTime } = parseTimeSlotWindow(sch.date, sch.timeSlot);
        if (schStatus !== "Completed" && schStatus !== "Cancelled") {
          if (endTime && now > endTime) {
            schStatus = "Missed";
          } else if (startTime && endTime && now >= startTime && now <= endTime) {
            schStatus = "Active";
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
          status: schStatus,
          isFrozen,
          startTime,
          endTime,
          drive: {
            title: sch.driveId ? sch.driveId.title : "Placement Drive",
            companyName,
          },
          driveTitle: sch.driveId ? sch.driveId.title : "Placement Drive",
          companyName,
        };
      })
    );

    const currently = [];
    const upcoming = [];
    const finished = [];

    for (const item of formattedSchedules) {
      if (item.status === "Completed" || item.status === "Cancelled" || item.status === "Missed") {
        finished.push(item);
      } else if (item.status === "Active") {
        currently.push(item);
      } else if (item.endTime && now > item.endTime) {
        item.status = "Missed";
        finished.push(item);
      } else if (item.startTime && item.endTime && now >= item.startTime && now <= item.endTime) {
        item.status = "Active";
        currently.push(item);
      } else {
        item.status = "Upcoming";
        upcoming.push(item);
      }
    }


    return res.status(200).json({
      success: true,
      isPlaced,
      placedCompany: placementStatus.companyName,
      placedDriveTitle: placementStatus.driveTitle,
      data: {
        currently,
        upcoming,
        finished,
        past: finished,
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

// PUT /api/student/offer/:applicationId/accept
const acceptOffer = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const application = await Application.findById(applicationId).populate("driveId");
    if (!application || application.studentId.toString() !== student._id.toString()) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized" });
    }

    if (application.offer.status === "Accepted") {
      return res.status(400).json({ success: false, message: "Offer has already been accepted" });
    }

    if (application.offer.status === "Declined") {
      return res.status(400).json({ success: false, message: "Cannot accept a previously declined offer" });
    }

    // Update Offer & Application Status
    application.offer.status = "Accepted";
    application.offer.acceptedAt = new Date();
    application.status = "Placed";

    await application.save();

    // Update Student placement status
    student.isPlaced = true;
    await student.save();

    // Send Real-time notification to recruiter
    if (application.driveId) {
      await socketService.sendRealTimeNotification(application.driveId.recruiterId, {
        title: "Job Offer Accepted",
        message: `${req.user.name} has accepted your job offer for the drive: "${application.driveId.title}".`,
        type: "success",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Congratulations! Offer accepted and placement status updated to Placed",
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to accept offer",
      error: error.message,
    });
  }
};

// PUT /api/student/offer/:applicationId/decline
const declineOffer = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { reason } = req.body;

    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const application = await Application.findById(applicationId).populate("driveId");
    if (!application || application.studentId.toString() !== student._id.toString()) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized" });
    }

    if (application.offer.status === "Accepted") {
      return res.status(400).json({ success: false, message: "Cannot decline an already accepted offer" });
    }

    application.offer.status = "Declined";
    application.offer.declinedAt = new Date();
    application.offer.declineReason = reason || "Personal Reasons";
    application.status = "Offer Declined";

    await application.save();

    // Send Real-time notification to recruiter
    if (application.driveId) {
      await socketService.sendRealTimeNotification(application.driveId.recruiterId, {
        title: "Job Offer Declined",
        message: `${req.user.name} has declined your job offer for the drive: "${application.driveId.title}". Reason: ${reason || "Personal Reasons"}`,
        type: "warning",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Offer declined successfully",
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to decline offer",
      error: error.message,
    });
  }
};

// GET /api/student/offer/:applicationId
const getOfferDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const application = await Application.findById(applicationId).populate("driveId");
    if (!application || application.studentId.toString() !== student._id.toString()) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized" });
    }

    const rec = await Recruiter.findOne({ userId: application.driveId?.recruiterId });
    const appObj = application.toObject();
    if (appObj.driveId) {
      appObj.driveId.companyName = rec ? rec.companyName : "Campus Recruiter";
      appObj.driveId.companyLogo = rec ? rec.companyLogo : null;
    }

    // Mark as Viewed if Sent
    if (application.offer.status === "Sent") {
      application.offer.status = "Viewed";
      application.offer.viewedAt = new Date();
      await application.save();
    }

    return res.status(200).json({
      success: true,
      application: appObj,
      offer: appObj.offer,
      drive: appObj.driveId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offer details",
      error: error.message,
    });
  }
};

// GET /api/student/offer/:applicationId/pdf
const getOfferPdf = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const fs = require("fs");
    const path = require("path");

    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student profile not found" });
    }

    const application = await Application.findById(applicationId);
    if (!application || application.studentId.toString() !== student._id.toString()) {
      return res.status(404).json({ success: false, message: "Application not found or unauthorized" });
    }

    if (!application.offer || (!application.offer.filePath && !application.offer.fileId)) {
      return res.status(404).json({ success: false, message: "Offer letter file not found" });
    }

    const relativePath = application.offer.filePath || `/uploads/offers/${application.offer.fileId}`;
    const absolutePath = path.join(__dirname, "..", relativePath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: "Offer letter file missing on server disk" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${application.offer.fileName || 'OfferLetter.pdf'}"`);

    return res.sendFile(absolutePath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve offer PDF",
      error: error.message,
    });
  }
};

const getPreparationResources = async (req, res) => {
  try {
    const { driveId } = req.params;
    const JobDrive = require("../models/JobDrive");
    const Recruiter = require("../models/Recruiter");
    const PastQuestion = require("../models/PastQuestion");

    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Job drive not found" });
    }

    const recruiter = await Recruiter.findOne({ userId: drive.recruiterId });
    if (!recruiter) {
      return res.status(404).json({ success: false, message: "Recruiter profile not found" });
    }

    const attachments = (drive.attachments || []).map((att) => ({
      fileId: att.gridFileId,
      fileName: att.fileName,
      fileSize: att.fileSize,
      uploadDate: att.uploadedAt,
    }));

    const pastQuestions = await PastQuestion.find({
      companyName: { $regex: new RegExp(`^${recruiter.companyName.trim()}$`, "i") },
    });

    const formattedQuestions = pastQuestions.map((q) => ({
      question: q.question,
      questionType: q.questionType,
      year: q.year,
    }));

    return res.status(200).json({
      success: true,
      driveTitle: drive.title,
      attachments,
      pastQuestions: formattedQuestions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to get preparation resources",
      error: error.message,
    });
  }
};

// GET /api/student/season-config
const getSeasonConfig = async (req, res) => {
  try {
    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      const currentYear = new Date().getFullYear();
      config = await CollegeConfig.create({
        seasonStart: new Date(currentYear, 7, 1),
        seasonEnd: new Date(currentYear, 11, 15),
      });
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

// GET /api/student/my-readiness
const getMyReadiness = async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
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
      message: "Failed to compute placement readiness",
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
  acceptOffer,
  declineOffer,
  getOfferDetails,
  getOfferPdf,
  getPreparationResources,
  getSeasonConfig,
  getMyReadiness,
};
