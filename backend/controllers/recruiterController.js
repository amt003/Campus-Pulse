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
          return {
            applicationId: app._id,
            appliedDate: app.appliedDate,
            status: app.status,
            aiMatchScore: app.aiMatchScore,
            student: studentObj ? {
              _id: studentObj._id,
              rollNumber: studentObj.rollNumber,
              cgpa: studentObj.cgpa,
              branch: studentObj.branch,
              resumePath: studentObj.resumePath,
              name: studentObj.userId ? studentObj.userId.name : "N/A"
            } : null,
            xai: app.xai,
            aptitude: app.aptitude,
            gd: app.gd,
            interview: app.interview
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
    const conflicts = [];
    const applications = [];

    // 1. Check all applications and scan for conflicts
    for (const appId of applicationIds) {
      const app = await Application.findById(appId).populate({
        path: "studentId",
        populate: { path: "userId", select: "name" }
      });

      if (!app) {
        return res.status(404).json({ success: false, message: `Application ${appId} not found` });
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
};

