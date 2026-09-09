const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");
const Recruiter = require("../models/Recruiter");
const User = require("../models/User");
const Student = require("../models/Student");
const CollegeConfig = require("../models/CollegeConfig");
const socketService = require("../services/socketService");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../utils/emailTemplates");
const { isStudentPlaced, getStudentPlacementStatus } = require("../utils/studentStatus");

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
    const { driveId } = req.params;
    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    // Security: Verify this drive belongs to this recruiter
    const drive = await JobDrive.findOne({ _id: driveId, recruiterId: req.user._id });
    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Drive not found or unauthorized",
      });
    }

    const applications = await Application.find({ driveId })
      .populate({
        path: "studentId",
        populate: {
          path: "userId",
          select: "name",
        },
      })
      .sort({ aiMatchScore: -1 }); // Highest score first

    // Batch check placed students elsewhere with company name
    const studentIds = applications.map(app => app.studentId?._id).filter(Boolean);
    const placedAppsElsewhere = await Application.find({
      studentId: { $in: studentIds },
      driveId: { $ne: driveId },
      $or: [
        { status: { $in: ["Placed", "Offer Accepted"] } },
        { "offer.status": "Accepted" }
      ]
    }).populate("driveId");

    const recruiterUserIds = placedAppsElsewhere.map(p => p.driveId?.recruiterId).filter(Boolean);
    const recruiters = await Recruiter.find({ userId: { $in: recruiterUserIds } });
    const recruiterMap = new Map();
    recruiters.forEach(r => {
      recruiterMap.set(r.userId.toString(), r.companyName);
    });

    const placedCompanyMap = new Map();
    placedAppsElsewhere.forEach(p => {
      const recUserId = p.driveId?.recruiterId?.toString();
      const compName = recUserId ? recruiterMap.get(recUserId) : null;
      placedCompanyMap.set(p.studentId.toString(), compName || "another company");
    });

    return res.status(200).json({
      success: true,
      data: {
        driveTitle: drive.title,
        driveDescription: drive.description,
        hasAptitudeTest: drive.hasAptitudeTest,
        hasGD: drive.hasGD,
        companyName: recruiter.companyName,
        applications: applications.map(app => {
          const studentObj = app.studentId;
          const placementCompany = studentObj ? placedCompanyMap.get(studentObj._id.toString()) || null : null;
          const isPlaced = !!placementCompany;

          return {
            applicationId: app._id,
            appliedDate: app.appliedDate,
            status: app.status,
            aiMatchScore: app.aiMatchScore,
            isPlacedGlobally: isPlaced,
            isPlaced,
            placementCompany,
            student: studentObj ? {
              _id: studentObj._id,
              rollNumber: studentObj.rollNumber,
              cgpa: studentObj.cgpa,
              branch: studentObj.branch,
              resumePath: studentObj.resumePath,
              name: studentObj.userId ? studentObj.userId.name : "N/A",
              isPlacedGlobally: isPlaced,
              isPlaced,
              placementCompany,
            } : null,
            xai: app.xai,
            aptitude: app.aptitude,
            gd: app.gd,
            interview: app.interview,
            offer: app.offer
          };
        })
      }
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

    // Guardrail: Validate application deadline against placement season configuration
    const seasonConfig = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (seasonConfig && seasonConfig.seasonEnd) {
      const deadlineDate = new Date(applicationDeadline);
      if (deadlineDate > new Date(seasonConfig.seasonEnd)) {
        return res.status(400).json({
          success: false,
          message: "Cannot schedule outside the placement season.",
        });
      }
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
      status: "Pending",
      submittedForApprovalAt: new Date(),
      tpoFeedback: null,
    });

    return res.status(201).json({
      success: true,
      message: "✅ Drive submitted for TPO approval. You will be notified once it's live.",
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

    const drivesWithCount = await Promise.all(
      drives.map(async (drive) => {
        const count = await Application.countDocuments({ driveId: drive._id });
        return {
          ...drive.toObject(),
          applicationsCount: count,
        };
      })
    );

    return res.status(200).json({
      success: true,
      drives: drivesWithCount,
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

    if (drive.status !== "OnHold" && drive.status !== "Draft" && drive.status !== "Open") {
      return res.status(400).json({
        success: false,
        message: `Editing is only allowed when drive status is On Hold or Draft (current status: ${drive.status}).`,
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
    ];

    if (req.body.applicationDeadline) {
      const seasonConfig = await CollegeConfig.findOne().sort({ updatedAt: -1 });
      if (seasonConfig && seasonConfig.seasonEnd) {
        const deadlineDate = new Date(req.body.applicationDeadline);
        if (deadlineDate > new Date(seasonConfig.seasonEnd)) {
          return res.status(400).json({
            success: false,
            message: "Cannot schedule outside the placement season.",
          });
        }
      }
    }

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        drive[field] = req.body[field];
      }
    });

    // If drive is OnHold, keep status as OnHold (do not auto-resubmit)
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

const resubmitDriveForApproval = async (req, res) => {
  try {
    const { driveId } = req.params;
    const drive = await JobDrive.findOne({
      _id: driveId,
      recruiterId: req.user._id,
    });

    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Job drive not found or not owned by recruiter",
      });
    }

    if (drive.status !== "OnHold" && drive.status !== "Draft") {
      return res.status(400).json({
        success: false,
        message: `Only drives currently On Hold or Draft can be resubmitted for approval (current status: ${drive.status}).`,
      });
    }

    drive.status = "Pending";
    drive.tpoFeedback = null;
    drive.submittedForApprovalAt = new Date();
    drive.resubmittedCount = (drive.resubmittedCount || 0) + 1;

    await drive.save();

    return res.status(200).json({
      success: true,
      message: "Drive resubmitted for TPO approval.",
      drive,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to resubmit job drive",
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
    const { studentIds, eventType, date, timeSlot, location, meetingUrl } = req.body;

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

    // Guardrail: Validate event date against placement season configuration
    const seasonConfig = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (seasonConfig) {
      const seasonStart = new Date(seasonConfig.seasonStart);
      const seasonEnd = new Date(seasonConfig.seasonEnd);
      if (scheduledDate < seasonStart || scheduledDate > seasonEnd) {
        return res.status(400).json({
          success: false,
          message: "Cannot schedule outside the placement season.",
        });
      }
    }

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

    // No conflicts detected — proceed to schedule eligible candidates
    for (const studentId of studentIds) {
      const placementStatus = await getStudentPlacementStatus(studentId, drive._id);
      if (placementStatus.isPlaced) {
        return res.status(409).json({
          success: false,
          message: `Cannot schedule candidate. This student has already been placed at ${placementStatus.companyName}.`,
        });
      }

      const application = await Application.findOne({ studentId, driveId: drive._id });

      if (application) {
        // Enforce stage progression: student MUST pass prior round to qualify for next round
        if (eventType === "GD" && drive.hasAptitudeTest) {
          const passedAptitude = application.aptitude && (application.aptitude.status === "Passed" || application.status === "Aptitude Completed");
          if (!passedAptitude) {
            continue; // Candidate did not pass Aptitude -> skip GD scheduling
          }
        } else if (eventType === "Interview") {
          if (drive.hasGD) {
            const passedGD = application.gd && (application.gd.status === "Shortlisted" || application.status === "GD Completed");
            if (!passedGD) {
              continue; // Candidate did not pass GD -> skip Interview scheduling
            }
          } else if (drive.hasAptitudeTest) {
            const passedAptitude = application.aptitude && (application.aptitude.status === "Passed" || application.status === "Aptitude Completed");
            if (!passedAptitude) {
              continue; // Candidate did not pass Aptitude -> skip Interview scheduling
            }
          }
        }

        const newSchedule = await Schedule.create({
          studentId,
          recruiterId: recruiter ? recruiter._id : req.user._id,
          driveId: drive._id,
          applicationId: application._id,
          eventType,
          date: scheduledDate,
          timeSlot,
          location: location || "Online",
          meetingUrl: meetingUrl || null,
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

        const studentDoc = await Student.findById(studentId).populate("userId");
        if (studentDoc && studentDoc.userId && studentDoc.userId.email) {
          await sendEmail({
            to: studentDoc.userId.email,
            ...emailTemplates.studentScheduled({
              studentName: studentDoc.userId.name,
              companyName: recruiter ? recruiter.companyName : "Recruiter",
              roundType: eventType,
              date: scheduledDate,
              time: timeSlot,
              location: location || "Online",
            }),
          });
        }
      }
    }

    if (createdSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: `None of the selected candidates are eligible for ${eventType}. Candidates must pass the required prior round first.`,
      });
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

const scheduleEvent = async (req, res) => {
  try {
    const { applicationIds, eventType, date, timeSlot, location, meetingUrl } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0 || !eventType || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: "applicationIds (array), eventType, date, and timeSlot are required",
      });
    }

    const scheduledDate = new Date(date);

    // Guardrail: Validate event date against placement season configuration
    const seasonConfig = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (seasonConfig) {
      const seasonStart = new Date(seasonConfig.seasonStart);
      const seasonEnd = new Date(seasonConfig.seasonEnd);
      if (scheduledDate < seasonStart || scheduledDate > seasonEnd) {
        return res.status(400).json({
          success: false,
          message: "Cannot schedule outside the placement season.",
        });
      }
    }

    const conflicts = [];
    const applications = [];

    // 1. Check all applications and scan for conflicts
    for (const appId of applicationIds) {
      const app = await Application.findById(appId).populate({
        path: "studentId",
        populate: { path: "userId", select: "name email" }
      });

      if (!app) {
        return res.status(404).json({ success: false, message: `Application ${appId} not found` });
      }

      if (app.studentId) {
        const placementStatus = await getStudentPlacementStatus(app.studentId._id, app.driveId);
        if (placementStatus.isPlaced) {
          const studentName = app.studentId.userId ? app.studentId.userId.name : "Student";
          return res.status(409).json({
            success: false,
            message: `Cannot schedule ${studentName}. This student has already been placed at ${placementStatus.companyName}.`,
          });
        }
      }

      applications.push(app);

      if (!app.studentId) continue;

      const studentId = app.studentId._id;
      const conflict = await Schedule.findOne({
        studentId,
        date: scheduledDate,
        timeSlot,
        status: "Scheduled",
      }).populate("driveId", "title");

      if (conflict) {
        const studentName = app.studentId.userId ? app.studentId.userId.name : "Unknown Student";
        const driveTitle = conflict.driveId ? conflict.driveId.title : "Another Drive";
        conflicts.push({
          studentName,
          eventType: conflict.eventType,
          timeSlot: conflict.timeSlot,
          driveTitle,
        });
      }
    }

    // 2. Return 409 Conflict if any overlap exists
    if (conflicts.length > 0) {
      const busyStudentNames = conflicts
        .map(c => `${c.studentName} is busy with ${c.eventType} for ${c.driveTitle} at ${c.timeSlot}`)
        .join(", ");
      return res.status(409).json({
        success: false,
        message: `Scheduling conflict: ${busyStudentNames}`,
        conflicts,
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    const createdSchedules = [];

    // 3. No conflicts — proceed to save schedules for stage-eligible candidates
    for (const app of applications) {
      const drive = await JobDrive.findById(app.driveId);
      if (drive) {
        if (eventType === "GD" && drive.hasAptitudeTest) {
          const passedAptitude = app.aptitude && (app.aptitude.status === "Passed" || app.status === "Aptitude Completed");
          if (!passedAptitude) continue;
        } else if (eventType === "Interview") {
          if (drive.hasGD) {
            const passedGD = app.gd && (app.gd.status === "Shortlisted" || app.status === "GD Completed");
            if (!passedGD) continue;
          } else if (drive.hasAptitudeTest) {
            const passedAptitude = app.aptitude && (app.aptitude.status === "Passed" || app.status === "Aptitude Completed");
            if (!passedAptitude) continue;
          }
        }
      }

      const newSchedule = await Schedule.create({
        studentId: app.studentId._id,
        recruiterId: recruiter ? recruiter._id : req.user._id,
        driveId: app.driveId,
        applicationId: app._id,
        eventType,
        date: scheduledDate,
        timeSlot,
        location: location || "Online",
        meetingUrl: meetingUrl || null,
        status: "Scheduled",
      });

      createdSchedules.push(newSchedule);

      if (eventType === "Aptitude") {
        app.aptitude.status = "Scheduled";
        app.aptitude.scheduledDate = scheduledDate;
        app.status = "Aptitude Scheduled";
      } else if (eventType === "GD") {
        app.gd.status = "Scheduled";
        app.gd.scheduledDate = scheduledDate;
        app.status = "GD Scheduled";
      } else if (eventType === "Interview") {
        app.interview.status = "Scheduled";
        app.interview.scheduledDate = scheduledDate;
        app.interview.timeSlot = timeSlot;
        app.status = "Interview Scheduled";
      }

      await app.save();

      if (app.studentId && app.studentId.userId) {
        await socketService.sendRealTimeNotification(app.studentId.userId._id, {
          title: `New Schedule: ${eventType} Round 📅`,
          message: `You have been scheduled for the ${eventType} round of ${recruiter ? recruiter.companyName : "Recruiter"} on ${new Date(scheduledDate).toDateString()} at ${timeSlot}.`,
          type: "info",
        });

        if (app.studentId.userId.email) {
          await sendEmail({
            to: app.studentId.userId.email,
            ...emailTemplates.studentScheduled({
              studentName: app.studentId.userId.name,
              companyName: recruiter ? recruiter.companyName : "Recruiter",
              roundType: eventType,
              date: scheduledDate,
              time: timeSlot,
              location: location || "Online",
            }),
          });
        }
      }
    }

    if (createdSchedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: `None of the selected candidates are eligible for ${eventType}. Candidates must pass the required prior round first.`,
      });
    }

    // Trigger notification placeholder
    console.log(`[Notification Placeholder] Emailed ${createdSchedules.length} candidates about scheduled ${eventType} round.`);

    const scheduledStudentNames = applications.map(app =>
      app.studentId.userId ? app.studentId.userId.name : "Student"
    );

    return res.status(200).json({
      success: true,
      message: `Successfully scheduled ${eventType} for selected candidates.`,
      scheduledStudents: scheduledStudentNames,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to schedule event",
      error: error.message,
    });
  }
};

const getAvailableStudentsForSlot = async (req, res) => {
  try {
    const { driveId, date, timeSlot } = req.body;
    if (!driveId || !date || !timeSlot) {
      return res.status(400).json({ success: false, message: "driveId, date, and timeSlot are required" });
    }

    // Find all applications for the drive
    const applications = await Application.find({ driveId }).populate({
      path: "studentId",
      populate: { path: "userId", select: "name" }
    });

    const availableApplications = [];
    const scheduledDate = new Date(date);

    for (const app of applications) {
      if (!app.studentId) continue;

      const conflict = await Schedule.findOne({
        studentId: app.studentId._id,
        date: scheduledDate,
        timeSlot,
        status: "Scheduled",
      });

      if (!conflict) {
        availableApplications.push(app);
      }
    }

    return res.status(200).json({
      success: true,
      data: availableApplications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check student availability",
      error: error.message,
    });
  }
};

const updateRecruiterProfile = async (req, res) => {
  try {
    const { companyName, officialEmail, website, contactPerson, phone, password } = req.body;
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

    if (companyName && companyName.trim()) {
      recruiter.companyName = companyName.trim();
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
      if (!website || !website.trim()) {
        return res.status(400).json({
          success: false,
          message: "Official company website URL is required",
        });
      }
      recruiter.website = website.trim();
    }

    if (contactPerson && contactPerson.trim()) {
      user.name = contactPerson.trim();
    }

    if (phone && phone.trim()) {
      user.phone = phone.trim();
    }

    if (req.file) {
      recruiter.companyLogo = `/uploads/logos/${req.file.filename}`;
    }

    if (password && password.trim()) {
      user.password = password;
    }

    recruiter.lastEditedAt = new Date();

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
        registrationStatus: recruiter.registrationStatus,
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


const getResumeText = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    const application = await Application.findById(applicationId).populate("studentId");
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const student = application.studentId;
    if (!student || !student.resumePath) {
      return res.status(404).json({
        success: false,
        message: "No resume found for this candidate",
      });
    }

    const fs = require("fs");
    const path = require("path");
    const { PDFParse } = require("pdf-parse");

    const absolutePath = path.join(__dirname, "..", student.resumePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found on server disk",
      });
    }

    const dataBuffer = fs.readFileSync(absolutePath);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    const resumeText = pdfData.text || "";

    return res.status(200).json({
      success: true,
      text: resumeText,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to parse candidate resume text",
      error: error.message,
    });
  }
};

const declareAptitudeResults = async (req, res) => {
  try {
    const { applicationIds, result, score, feedback } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0 || !result) {
      return res.status(400).json({
        success: false,
        message: "applicationIds (array) and result are required",
      });
    }

    if (result !== "Passed" && result !== "Failed") {
      return res.status(400).json({
        success: false,
        message: "Result must be either 'Passed' or 'Failed'",
      });
    }

    if (score === undefined || score === null || isNaN(score) || score < 0) {
      return res.status(400).json({
        success: false,
        message: "Marks / Score is required and must be a valid number >= 0",
      });
    }

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: "Performance Feedback / Explanation is required",
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const applications = await Application.find({ _id: { $in: applicationIds } }).populate("driveId");

    for (const app of applications) {
      if (!app.driveId || app.driveId.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to declare results for some of these applications",
        });
      }

      const placementStatus = await getStudentPlacementStatus(app.studentId, app.driveId);
      if (placementStatus.isPlaced) {
        return res.status(409).json({
          success: false,
          message: `Cannot mark results for candidate(s) who have already been placed at ${placementStatus.companyName}.`,
        });
      }

      if (app.status !== "Aptitude Scheduled" && app.status !== "Aptitude Completed") {
        return res.status(400).json({
          success: false,
          message: "You cannot mark results for this student as they haven't been scheduled yet.",
        });
      }
    }

    for (const app of applications) {
      app.aptitude.status = result;
      app.aptitude.markedBy = recruiter._id;
      app.aptitude.markedAt = new Date();
      if (score !== undefined) {
        app.aptitude.score = score;
      }
      if (feedback !== undefined) {
        app.aptitude.feedback = feedback;
      }
      app.status = "Aptitude Completed";
      await app.save();

      const studentDoc = await Student.findById(app.studentId);
      if (studentDoc) {
        const title = result === "Passed" ? "Aptitude Test Passed 🎉" : "Aptitude Test Update 📝";
        const message = result === "Passed"
          ? `Congratulations! You passed the Aptitude round for ${app.driveId ? app.driveId.title : "Placement Drive"}.`
          : `Thank you for participating. You were not shortlisted in the Aptitude round for ${app.driveId ? app.driveId.title : "Placement Drive"}.`;
        await socketService.sendRealTimeNotification(studentDoc.userId, {
          title,
          message,
          type: result === "Passed" ? "success" : "info",
        });
      }
      await Schedule.updateMany(
        { applicationId: app._id, eventType: "Aptitude" },
        { status: "Completed" }
      );
    }

    return res.status(200).json({
      success: true,
      message: `${applications.length} students marked as ${result} successfully!`,
      count: applications.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to declare Aptitude results",
      error: error.message,
    });
  }
};

const declareGDResults = async (req, res) => {
  try {
    const { applicationIds, result, feedback, score } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0 || !result) {
      return res.status(400).json({
        success: false,
        message: "applicationIds (array) and result are required",
      });
    }

    if (result !== "Shortlisted" && result !== "Rejected") {
      return res.status(400).json({
        success: false,
        message: "Result must be either 'Shortlisted' or 'Rejected'",
      });
    }

    if (score === undefined || score === null || isNaN(score) || score < 0) {
      return res.status(400).json({
        success: false,
        message: "Marks / Score is required and must be a valid number >= 0",
      });
    }

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: "Performance Feedback / Explanation is required",
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const applications = await Application.find({ _id: { $in: applicationIds } }).populate("driveId");

    for (const app of applications) {
      if (!app.driveId || app.driveId.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to declare results for some of these applications",
        });
      }

      const placementStatus = await getStudentPlacementStatus(app.studentId, app.driveId);
      if (placementStatus.isPlaced) {
        return res.status(409).json({
          success: false,
          message: `Cannot mark results for candidate(s) who have already been placed at ${placementStatus.companyName}.`,
        });
      }

      if (app.status !== "GD Scheduled" && app.status !== "GD Completed") {
        return res.status(400).json({
          success: false,
          message: "You cannot mark results for this student as they haven't been scheduled yet.",
        });
      }
    }

    for (const app of applications) {
      app.gd.status = result;
      app.gd.markedBy = recruiter._id;
      app.gd.markedAt = new Date();
      if (score !== undefined && score !== null) {
        app.gd.score = score;
      }
      if (feedback !== undefined) {
        app.gd.feedback = feedback.trim();
      }
      app.status = "GD Completed";
      await app.save();

      const studentDoc = await Student.findById(app.studentId);
      if (studentDoc) {
        const title = result === "Shortlisted" ? "GD Round Shortlisted 👥" : "GD Round Update 📝";
        const message = result === "Shortlisted"
          ? `Congratulations! You passed the Group Discussion round for ${app.driveId ? app.driveId.title : "Placement Drive"}.`
          : `Thank you for participating. You were not shortlisted in the Group Discussion round for ${app.driveId ? app.driveId.title : "Placement Drive"}.`;
        await socketService.sendRealTimeNotification(studentDoc.userId, {
          title,
          message,
          type: result === "Shortlisted" ? "success" : "info",
        });
      }
      await Schedule.updateMany(
        { applicationId: app._id, eventType: "GD" },
        { status: "Completed" }
      );
    }

    return res.status(200).json({
      success: true,
      message: `${applications.length} students marked as ${result} successfully!`,
      count: applications.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to declare GD results",
      error: error.message,
    });
  }
};

const declareInterviewResults = async (req, res) => {
  try {
    const { applicationIds, result, feedback, score } = req.body;

    if (!Array.isArray(applicationIds) || applicationIds.length === 0 || !result) {
      return res.status(400).json({
        success: false,
        message: "applicationIds (array) and result are required",
      });
    }

    if (result !== "Selected" && result !== "Rejected" && result !== "Waitlisted") {
      return res.status(400).json({
        success: false,
        message: "Result must be 'Selected', 'Rejected', or 'Waitlisted'",
      });
    }

    if (score === undefined || score === null || isNaN(score) || score < 0) {
      return res.status(400).json({
        success: false,
        message: "Marks / Score is required and must be a valid number >= 0",
      });
    }

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: "Performance Feedback / Explanation is required",
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const applications = await Application.find({ _id: { $in: applicationIds } }).populate("driveId");

    for (const app of applications) {
      if (!app.driveId || app.driveId.recruiterId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to declare results for some of these applications",
        });
      }

      const placementStatus = await getStudentPlacementStatus(app.studentId, app.driveId);
      if (placementStatus.isPlaced) {
        return res.status(409).json({
          success: false,
          message: `Cannot mark results for candidate(s) who have already been placed at ${placementStatus.companyName}.`,
        });
      }

      if (app.status !== "Interview Scheduled" && app.status !== "Interview Completed") {
        return res.status(400).json({
          success: false,
          message: "You cannot mark results for this student as they haven't been scheduled yet.",
        });
      }
    }

    for (const app of applications) {
      app.interview.status = "Completed";
      app.interview.result = result;
      app.interview.markedBy = recruiter._id;
      app.interview.markedAt = new Date();
      if (score !== undefined && score !== null) {
        app.interview.score = score;
      }
      if (feedback !== undefined) {
        app.interview.feedback = feedback.trim();
      }
      app.status = "Interview Completed";
      await app.save();

      const studentDoc = await Student.findById(app.studentId);
      if (studentDoc) {
        let title = "Interview Completed 💬";
        let message = `Your Interview results have been declared for ${app.driveId ? app.driveId.title : "Placement Drive"}. Status: ${result}`;
        let type = "info";
        if (result === "Selected") {
          title = "Selected for Placement! 🏆";
          message = `Congratulations! You have been selected in the Interview round for ${app.driveId ? app.driveId.title : "Placement Drive"}! Prepare for the official offer.`;
          type = "success";
        }
        await socketService.sendRealTimeNotification(studentDoc.userId, {
          title,
          message,
          type,
        });
      }
      await Schedule.updateMany(
        { applicationId: app._id, eventType: "Interview" },
        { status: "Completed" }
      );
    }

    return res.status(200).json({
      success: true,
      message: `${applications.length} students marked as ${result} successfully!`,
      count: applications.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to declare Interview results",
      error: error.message,
    });
  }
};

// POST /api/recruiter/request-reapproval — on-hold recruiter submits for re-approval after editing
const requestReapproval = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(404).json({ success: false, message: "Recruiter profile not found" });
    }

    if (recruiter.registrationStatus !== "on_hold") {
      return res.status(400).json({
        success: false,
        message: "Only on-hold recruiters can request re-approval.",
      });
    }

    recruiter.registrationStatus = "pending";
    recruiter.isApproved = false;
    recruiter.status = "Pending";
    recruiter.holdFeedback = { message: "", suggestions: "", providedBy: null, providedAt: null };
    recruiter.lastEditedAt = new Date();
    await recruiter.save();

    return res.status(200).json({
      success: true,
      message: "Re-approval request submitted. The TPO will review your updated profile.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit re-approval request",
      error: error.message,
    });
  }
};

// POST /api/recruiter/application/:applicationId/offer
const uploadOfferLetter = async (req, res) => {
  try {
    const { applicationId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an offer letter PDF file",
      });
    }

    const application = await Application.findById(applicationId).populate("driveId");
    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(403).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const placementStatus = await getStudentPlacementStatus(application.studentId, application.driveId);
    if (placementStatus.isPlaced) {
      return res.status(409).json({
        success: false,
        message: `Cannot send offer. This student has already been placed at ${placementStatus.companyName}.`,
      });
    }

    // Security check: verify recruiter owns this drive
    if (application.driveId && application.driveId.recruiterId.toString() !== recruiter._id.toString() && application.driveId.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to upload offer letters for this drive",
      });
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

    application.offer.status = "Sent";
    application.offer.fileId = req.file.filename;
    application.offer.filePath = `/uploads/offers/${req.file.filename}`;
    application.offer.fileName = req.file.originalname;
    application.offer.uploadedDate = now;
    application.offer.expiryDate = expiry;
    application.status = "Offer Sent";

    await application.save();

    const studentDoc = await Student.findById(application.studentId).populate("userId");
    if (studentDoc) {
      await socketService.sendRealTimeNotification(studentDoc.userId._id || studentDoc.userId, {
        title: "Official Job Offer Received! ✉️",
        message: `Congratulations! ${recruiter.companyName} has sent you an official job offer letter for the drive: "${application.driveId ? application.driveId.title : "Job Drive"}". Please check your Offers tab.`,
        type: "success",
      });

      if (studentDoc.userId && studentDoc.userId.email) {
        await sendEmail({
          to: studentDoc.userId.email,
          ...emailTemplates.offerUploaded({
            studentName: studentDoc.userId.name,
            companyName: recruiter.companyName,
          }),
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Offer letter uploaded and sent to candidate successfully",
      offer: application.offer,
      application,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to upload offer letter",
      error: error.message,
    });
  }
};

// GET /api/recruiter/application/:applicationId/offer-template
const getOfferTemplateData = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name email phone" },
      })
      .populate("driveId");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });

    // Format ctc into INR locale representation
    const rawCtc = application.driveId?.ctc || 1200000;
    const formattedCtc = typeof rawCtc === "number" ? rawCtc.toLocaleString("en-IN") : rawCtc;

    const studentName = application.studentId?.userId?.name || application.studentId?.name || "Candidate";
    const rollNumber = application.studentId?.rollNumber || "N/A";
    const branch = application.studentId?.branch || "Computer Science & Engineering";
    const jobRole = application.driveId?.title || application.driveId?.role || "Software Development Engineer";
    const companyName = recruiter?.companyName || application.driveId?.companyName || "Campus Recruiter";
    const topSkill = (application.studentId?.skills && application.studentId.skills[0]) || "Software Engineering";

    return res.status(200).json({
      success: true,
      data: {
        applicationId: application._id,
        studentName,
        rollNumber,
        branch,
        jobRole,
        ctc: formattedCtc,
        companyName,
        officialEmail: recruiter?.officialEmail || recruiter?.email || "",
        website: recruiter?.website || "",
        companyLogo: recruiter?.companyLogo || null,
        topSkill,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offer template data",
      error: error.message,
    });
  }
};

// POST /api/recruiter/drive/:driveId/bulk-aptitude
const bulkUploadAptitudeScores = async (req, res) => {
  try {
    const { driveId } = req.params;
    const { cutoffScore, scores, csvContent } = req.body;

    if (cutoffScore === undefined || cutoffScore === null || isNaN(cutoffScore)) {
      return res.status(400).json({
        success: false,
        message: "Cutoff score is required and must be a valid number",
      });
    }

    let parsedScores = Array.isArray(scores) ? scores : [];

    // If csvContent string was passed, parse it line by line
    if (!parsedScores.length && typeof csvContent === "string") {
      const lines = csvContent.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.toLowerCase().startsWith("roll")) continue;
        const parts = trimmed.split(/[,;\t\s]+/);
        if (parts.length >= 2) {
          const rollNumber = parts[0].trim();
          const scoreNum = parseFloat(parts[1].trim());
          if (rollNumber && !isNaN(scoreNum)) {
            parsedScores.push({ rollNumber, score: scoreNum });
          }
        }
      }
    }

    if (parsedScores.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid student scores found in batch data. Expected format: RollNumber, Score",
      });
    }

    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Job drive not found" });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter || drive.recruiterId.toString() !== recruiter._id.toString() && drive.recruiterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized to manage this drive" });
    }

    // Fetch all applications for this drive
    const applications = await Application.find({ driveId }).populate("studentId");

    // Build map of Roll Number (and email) to Application
    const appMap = new Map();
    applications.forEach((app) => {
      if (app.studentId) {
        if (app.studentId.rollNumber) {
          appMap.set(app.studentId.rollNumber.trim().toLowerCase(), app);
        }
        if (app.studentId.email) {
          appMap.set(app.studentId.email.trim().toLowerCase(), app);
        }
      }
    });

    let passedCount = 0;
    let failedCount = 0;
    const skippedList = [];

    const cutoff = Number(cutoffScore);

    for (const item of parsedScores) {
      const rollKey = (item.rollNumber || "").trim().toLowerCase();
      const app = appMap.get(rollKey);

      if (!app) {
        skippedList.push({
          rollNumber: item.rollNumber,
          score: item.score,
          reason: "Candidate not found in drive applications",
        });
        continue;
      }

      // NEW VALIDATION STEP: Only update candidates whose status is "Aptitude Scheduled" (or "Aptitude Completed" for re-imports)
      if (app.status !== "Aptitude Scheduled" && app.status !== "Aptitude Completed") {
        skippedList.push({
          rollNumber: item.rollNumber,
          score: item.score,
          reason: `Not scheduled for Aptitude (Current status: ${app.status})`,
        });
        continue;
      }

      const scoreNum = Number(item.score);
      const isPassed = scoreNum >= cutoff;

      app.aptitude.score = scoreNum;
      app.aptitude.status = isPassed ? "Passed" : "Failed";
      app.aptitude.result = isPassed ? "Passed" : "Failed";
      app.aptitude.feedback = isPassed
        ? `Passed Aptitude Test (Score: ${scoreNum}, Cutoff: ${cutoff})`
        : `Below Cutoff Score (Score: ${scoreNum}, Cutoff: ${cutoff})`;
      app.aptitude.markedBy = recruiter._id;
      app.aptitude.markedAt = new Date();

      if (isPassed) {
        app.status = "Aptitude Completed";
        passedCount++;
      } else {
        app.status = "Rejected";
        failedCount++;
      }

      await app.save();
      await Schedule.updateMany(
        { applicationId: app._id, eventType: "Aptitude" },
        { status: "Completed" }
      );
    }

    const updatedCount = passedCount + failedCount;

    return res.status(200).json({
      success: true,
      message: "Bulk Aptitude score processing completed with status validation",
      summary: {
        totalRows: parsedScores.length,
        updated: updatedCount,
        skipped: skippedList.length,
        passed: passedCount,
        failed: failedCount,
        cutoffScore: cutoff,
        skippedDetails: skippedList,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to process bulk aptitude scores",
      error: error.message,
    });
  }
};

// GET /api/recruiter/analytics — Dashboard pipeline stats & upcoming interviews
const getRecruiterAnalytics = async (req, res) => {
  try {
    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    const recruiterIdFilter = recruiter ? recruiter._id : req.user._id;

    // Find all job drives by this recruiter
    const drives = await JobDrive.find({
      $or: [{ recruiterId: recruiterIdFilter }, { recruiterId: req.user._id }],
    });
    const driveIds = drives.map((d) => d._id);

    // Fetch all applications
    const applications = await Application.find({ driveId: { $in: driveIds } });

    let appliedCount = applications.length;
    let screeningCount = 0;
    let interviewCount = 0;
    let offerCount = 0;

    let totalOffersCount = 0;
    let acceptedOffersCount = 0;

    const screeningStatuses = [
      "Under Review",
      "Aptitude Scheduled",
      "Aptitude Completed",
      "GD Scheduled",
      "GD Completed",
    ];
    const interviewStatuses = [
      "Interview Scheduled",
      "Interview Completed",
      "Selected",
      "Waitlisted",
    ];
    const offerStatuses = [
      "Offer Sent",
      "Offer Accepted",
      "Offer Declined",
      "Placed",
    ];

    applications.forEach((app) => {
      const isAccepted =
        app.status === "Offer Accepted" ||
        app.status === "Placed" ||
        app.offer?.status === "Accepted";
      const isDeclined =
        app.status === "Offer Declined" || app.offer?.status === "Declined";
      const isOfferSent =
        app.status === "Offer Sent" ||
        app.offer?.status === "Sent" ||
        app.offer?.status === "Viewed";

      if (isAccepted || isDeclined || isOfferSent) {
        totalOffersCount++;
        if (isAccepted) {
          acceptedOffersCount++;
        }
      }

      if (screeningStatuses.includes(app.status)) {
        screeningCount++;
      } else if (interviewStatuses.includes(app.status)) {
        interviewCount++;
      } else if (offerStatuses.includes(app.status)) {
        offerCount++;
      }
    });

    const offerAcceptanceRate =
      totalOffersCount > 0
        ? Number(((acceptedOffersCount / totalOffersCount) * 100).toFixed(1))
        : 0;

    // Fetch upcoming interview schedules
    const upcomingSchedules = await Schedule.find({
      $or: [{ recruiterId: recruiterIdFilter }, { recruiterId: req.user._id }],
      eventType: "Interview",
      status: "Scheduled",
    })
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name" },
      })
      .populate("driveId", "title")
      .sort({ date: 1 })
      .limit(5);

    const formattedInterviews = upcomingSchedules.map((sch) => {
      const studentName =
        sch.studentId && sch.studentId.userId
          ? sch.studentId.userId.name
          : "Candidate";
      const role = sch.driveId ? sch.driveId.title : "SDE Intern";

      const schDate = new Date(sch.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const schDay = new Date(schDate);
      schDay.setHours(0, 0, 0, 0);

      let dateStr = "";
      if (schDay.getTime() === today.getTime()) {
        dateStr = `TODAY @ ${sch.timeSlot}`;
      } else if (schDay.getTime() === tomorrow.getTime()) {
        dateStr = `TOMORROW @ ${sch.timeSlot}`;
      } else {
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        dateStr = `${schDate.getDate()} ${monthNames[schDate.getMonth()]} @ ${sch.timeSlot}`;
      }

      return {
        dateStr,
        studentName,
        role,
      };
    });

    return res.status(200).json({
      success: true,
      analytics: {
        pipeline: {
          applied: appliedCount,
          screening: screeningCount,
          interview: interviewCount,
          offer: offerCount,
        },
        offerAcceptanceRate,
        totalOffers: totalOffersCount,
        acceptedOffers: acceptedOffersCount,
        upcomingInterviews: formattedInterviews,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recruiter analytics",
      error: error.message,
    });
  }
};

const getDriveAttachments = async (req, res) => {
  try {
    const { driveId } = req.params;
    const JobDrive = require("../models/JobDrive");
    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Job drive not found" });
    }
    return res.status(200).json({ success: true, attachments: drive.attachments || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to get attachments", error: error.message });
  }
};

const uploadDriveAttachment = async (req, res) => {
  try {
    const { driveId } = req.params;
    const JobDrive = require("../models/JobDrive");
    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Job drive not found" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { GridFSBucket } = require("mongodb");
    const mongoose = require("mongoose");
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "resources" });
    
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
    });
    
    uploadStream.end(req.file.buffer);
    
    uploadStream.on("finish", async () => {
      const fileId = uploadStream.id;
      if (!drive.attachments) {
        drive.attachments = [];
      }
      const newAttachment = {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        gridFileId: fileId,
        uploadedAt: new Date()
      };
      drive.attachments.push(newAttachment);
      await drive.save();
      return res.status(200).json({
        success: true,
        message: "Resource uploaded successfully",
        attachment: newAttachment
      });
    });
    
    uploadStream.on("error", (err) => {
      return res.status(500).json({ success: false, message: "GridFS upload stream failed", error: err.message });
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to upload resource", error: error.message });
  }
};

const deleteDriveAttachment = async (req, res) => {
  try {
    const { driveId, fileId } = req.params;
    const JobDrive = require("../models/JobDrive");
    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({ success: false, message: "Job drive not found" });
    }

    const { GridFSBucket, ObjectId } = require("mongodb");
    const mongoose = require("mongoose");
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "resources" });
    
    // Remove from GridFS if it exists
    try {
      await bucket.delete(new ObjectId(fileId));
    } catch (err) {
      console.warn("File did not exist in GridFS, continuing deletion from document:", err.message);
    }
    
    // Pull from drive.attachments array
    drive.attachments = drive.attachments.filter(att => att.gridFileId.toString() !== fileId);
    await drive.save();
    
    return res.status(200).json({ success: true, message: "Resource deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete resource", error: error.message });
  }
};

const downloadDriveAttachment = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { GridFSBucket, ObjectId } = require("mongodb");
    const mongoose = require("mongoose");
    const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: "resources" });
    
    const fileObjectId = new ObjectId(fileId);
    const files = await mongoose.connection.db.collection("resources.files").find({ _id: fileObjectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }
    
    res.set({
      "Content-Type": files[0].contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${files[0].filename}"`,
    });
    
    const downloadStream = bucket.openDownloadStream(fileObjectId);
    downloadStream.pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Download failed", error: error.message });
  }
};

const getAllRecruiterApplications = async (req, res) => {
  try {
    const drives = await JobDrive.find({ recruiterId: req.user._id }).select("_id title companyName ctc");
    const driveIds = drives.map((d) => d._id);

    const applications = await Application.find({ driveId: { $in: driveIds } })
      .populate({
        path: "studentId",
        populate: {
          path: "userId",
          select: "name email phone",
        },
      })
      .populate("driveId", "title companyName ctc status recruiterId")
      .sort({ createdAt: -1 });

    const studentIds = applications.map((app) => app.studentId?._id).filter(Boolean);

    // Find all accepted offers / placement records for these students
    const acceptedApps = await Application.find({
      studentId: { $in: studentIds },
      $or: [
        { status: { $in: ["Placed", "Offer Accepted"] } },
        { "offer.status": "Accepted" }
      ]
    }).populate("driveId");

    const recruiterUserIds = acceptedApps.map((p) => p.driveId?.recruiterId).filter(Boolean);
    const recruiters = await Recruiter.find({ userId: { $in: recruiterUserIds } });
    const recruiterMap = new Map();
    recruiters.forEach((r) => {
      recruiterMap.set(r.userId.toString(), r.companyName);
    });

    const acceptedMap = new Map();
    acceptedApps.forEach((p) => {
      const recUserId = p.driveId?.recruiterId?.toString();
      const compName = recUserId ? recruiterMap.get(recUserId) : null;
      acceptedMap.set(p.studentId._id.toString(), {
        driveId: p.driveId?._id?.toString(),
        companyName: compName || "another company",
        title: p.driveId?.title || "Placement Drive"
      });
    });

    const formattedApplications = applications.map((app) => {
      const appObj = app.toObject();
      const studentIdStr = app.studentId?._id?.toString();
      const placementInfo = studentIdStr ? acceptedMap.get(studentIdStr) : null;

      if (placementInfo) {
        if (placementInfo.driveId === app.driveId?._id?.toString()) {
          appObj.isPlacedInThisDrive = true;
          appObj.displayStatus = "Offer Accepted 🎉";
        } else {
          appObj.isPlacedElsewhere = true;
          appObj.isPlacedGlobally = true;
          appObj.isPlaced = true;
          appObj.placementCompany = placementInfo.companyName;
          appObj.displayStatus = `Placed at ${placementInfo.companyName}`;
        }
      }

      return appObj;
    });

    return res.status(200).json({
      success: true,
      applications: formattedApplications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recruiter applications",
      error: error.message,
    });
  }
};

const getAllRecruiterOffers = async (req, res) => {
  try {
    const drives = await JobDrive.find({ recruiterId: req.user._id }).select("_id title companyName ctc");
    const driveIds = drives.map((d) => d._id);

    const applications = await Application.find({
      driveId: { $in: driveIds },
      "offer.status": { $exists: true, $ne: "Not Sent" },
    })
      .populate({
        path: "studentId",
        populate: {
          path: "userId",
          select: "name email phone",
        },
      })
      .populate("driveId", "title companyName ctc")
      .sort({ "offer.uploadedDate": -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      offers: applications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch offer letters",
      error: error.message,
    });
  }
};

const getRecruiterOfferPdf = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const fs = require("fs");
    const path = require("path");

    const application = await Application.findById(applicationId).populate("driveId");
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    const recruiter = await Recruiter.findOne({ userId: req.user._id });
    if (!recruiter) {
      return res.status(403).json({ success: false, message: "Recruiter profile not found" });
    }

    // Security check: verify recruiter owns this drive
    if (
      application.driveId &&
      application.driveId.recruiterId.toString() !== recruiter._id.toString() &&
      application.driveId.recruiterId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "You are not authorized to download offer letters for this drive" });
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
  scheduleEvent,
  getAvailableStudentsForSlot,
  updateRecruiterProfile,
  requestReapproval,
  getResumeText,
  declareAptitudeResults,
  declareGDResults,
  declareInterviewResults,
  uploadOfferLetter,
  getOfferTemplateData,
  bulkUploadAptitudeScores,
  getRecruiterAnalytics,
  getDriveAttachments,
  uploadDriveAttachment,
  deleteDriveAttachment,
  downloadDriveAttachment,
  getAllRecruiterApplications,
  getAllRecruiterOffers,
  getRecruiterOfferPdf,
  resubmitDriveForApproval,
  getSeasonConfig,
};

