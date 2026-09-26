const AptitudeTest = require("../models/AptitudeTest");
const QuestionBank = require("../models/QuestionBank");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");
const Student = require("../models/Student");
const Recruiter = require("../models/Recruiter");
const TestAttempt = require("../models/TestAttempt");
const sendEmail = require("../utils/sendEmail");
const emailTemplates = require("../utils/emailTemplates");
const { getStudentPlacementStatus } = require("../utils/studentStatus");

// Helper to get authenticated recruiter profile
const getAuthenticatedRecruiter = async (userId) => {
  return await Recruiter.findOne({ userId });
};

// @desc    Create a new aptitude test in Draft status
// @route   POST /api/recruiter/test
// @access  Private (Recruiter)
const createTest = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const {
      driveId,
      title,
      durationMinutes,
      questionIds,
      passingScore,
      scheduledDate,
      timeSlot,
      generationMode = "manual",
      shuffleQuestions = true,
      shuffleOptions = true,
      antiCheatEnabled = true,
      maxViolations = 3,
    } = req.body;

    if (!driveId || !title || !durationMinutes || !questionIds || passingScore === undefined) {
      return res.status(400).json({
        success: false,
        message: "driveId, title, durationMinutes, questionIds, and passingScore are required",
      });
    }

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "questionIds must be a non-empty array of QuestionBank IDs",
      });
    }

    // 1. Validate recruiter owns the job drive
    const drive = await JobDrive.findById(driveId);
    if (!drive) {
      return res.status(404).json({
        success: false,
        message: "Job drive not found",
      });
    }

    const ownsDrive =
      (drive.recruiterId && drive.recruiterId.toString() === req.user._id.toString()) ||
      (drive.recruiterId && drive.recruiterId.toString() === recruiter._id.toString());

    if (!ownsDrive) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to create a test for this job drive",
      });
    }

    // 2. Validate all questionIds exist and are APPROVED
    const questions = await QuestionBank.find({ _id: { $in: questionIds } });
    if (questions.length !== questionIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more question IDs could not be found in QuestionBank",
      });
    }

    const unapprovedQuestions = questions.filter((q) => q.status !== "approved");
    if (unapprovedQuestions.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot create test: all questions must be approved. Found ${unapprovedQuestions.length} unapproved question(s).`,
        unapprovedQuestionIds: unapprovedQuestions.map((q) => q._id),
      });
    }

    // 3. Create test with status Draft
    const test = await AptitudeTest.create({
      driveId,
      recruiterId: recruiter._id,
      title: title.trim(),
      durationMinutes: parseInt(durationMinutes, 10),
      questionIds,
      passingScore: parseFloat(passingScore),
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      timeSlot: timeSlot ? timeSlot.trim() : null,
      status: "Draft",
      generationMode,
      shuffleQuestions: Boolean(shuffleQuestions),
      shuffleOptions: Boolean(shuffleOptions),
      antiCheatEnabled: Boolean(antiCheatEnabled),
      maxViolations: parseInt(maxViolations, 10) || 3,
      createdAt: new Date(),
    });

    // Increment timesUsed on the selected questions
    await QuestionBank.updateMany(
      { _id: { $in: questionIds } },
      { $inc: { timesUsed: 1 } }
    );

    return res.status(201).json({
      success: true,
      message: "Aptitude test created successfully in Draft status",
      test,
      data: test,
    });
  } catch (error) {
    console.error("[AptitudeTestController] createTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create aptitude test",
      error: error.message,
    });
  }
};

// @desc    Publish an aptitude test (sets Active, schedules shortlisted students, sends emails)
// @route   PUT /api/recruiter/test/:id/publish
// @access  Private (Recruiter)
const publishTest = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const test = await AptitudeTest.findById(req.params.id).populate("driveId");
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Aptitude test not found",
      });
    }

    if (test.recruiterId.toString() !== recruiter._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to publish this test",
      });
    }

    // 1. Validate all questions are still approved
    const questions = await QuestionBank.find({ _id: { $in: test.questionIds } });
    const unapproved = questions.filter((q) => q.status !== "approved");
    if (unapproved.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot publish test: one or more questions are not approved",
      });
    }

    // Determine scheduledDate and timeSlot (from body or test document)
    const scheduledDate = req.body.scheduledDate
      ? new Date(req.body.scheduledDate)
      : test.scheduledDate || new Date();

    const timeSlot = req.body.timeSlot ? req.body.timeSlot.trim() : test.timeSlot || "10:00 AM - 11:00 AM";

    test.scheduledDate = scheduledDate;
    test.timeSlot = timeSlot;
    test.status = "Active";
    await test.save();

    // 2. Find eligible / shortlisted applications for this job drive
    let targetApplications = [];
    if (req.body.studentIds && Array.isArray(req.body.studentIds) && req.body.studentIds.length > 0) {
      targetApplications = await Application.find({
        driveId: test.driveId._id || test.driveId,
        studentId: { $in: req.body.studentIds },
      });
    } else {
      // Find all candidates currently shortlisted, applied, or under review for this drive
      targetApplications = await Application.find({
        driveId: test.driveId._id || test.driveId,
        status: { $in: ["Aptitude Scheduled", "Under Review", "Applied"] },
      });
    }

    const createdSchedules = [];
    const conflicts = [];
    const scheduledStudentIds = [];

    for (const app of targetApplications) {
      const studentId = app.studentId;

      // Check placement status
      const placement = await getStudentPlacementStatus(studentId, test.driveId._id || test.driveId);
      if (placement.isPlaced) {
        continue;
      }

      // Check conflict detection
      const existingSchedule = await Schedule.findOne({
        studentId,
        date: scheduledDate,
        timeSlot,
        status: "Scheduled",
      });

      if (existingSchedule) {
        conflicts.push({
          studentId,
          conflictingDrive: existingSchedule.driveId,
          eventType: existingSchedule.eventType,
          timeSlot: existingSchedule.timeSlot,
        });
        continue;
      }

      // Create Schedule entry with eventType 'Aptitude'
      const newSchedule = await Schedule.create({
        studentId,
        recruiterId: recruiter._id,
        driveId: test.driveId._id || test.driveId,
        applicationId: app._id,
        eventType: "Aptitude",
        date: scheduledDate,
        timeSlot,
        location: "Online - CampusPulse",
        meetingUrl: null,
        status: "Scheduled",
      });

      createdSchedules.push(newSchedule);
      scheduledStudentIds.push(studentId);

      // Link application to aptitude test and set status
      app.status = "Aptitude Scheduled";
      if (!app.aptitude) {
        app.aptitude = {};
      }
      app.aptitude.status = "Scheduled";
      app.aptitude.source = "in_house";
      await app.save();

      // Send reminder / scheduling email
      const studentDoc = await Student.findById(studentId).populate("userId");
      if (studentDoc && studentDoc.userId && studentDoc.userId.email) {
        await sendEmail({
          to: studentDoc.userId.email,
          ...emailTemplates.studentScheduled({
            studentName: studentDoc.userId.name,
            companyName: recruiter.companyName || "Recruiter",
            roundType: "Aptitude",
            date: scheduledDate,
            time: timeSlot,
            location: "Online - CampusPulse",
          }),
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Test published successfully as Active. Scheduled ${createdSchedules.length} student(s).`,
      test,
      schedulesCreated: createdSchedules.length,
      conflictsEncountered: conflicts.length,
      conflicts,
      data: test,
    });
  } catch (error) {
    console.error("[AptitudeTestController] publishTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to publish aptitude test",
      error: error.message,
    });
  }
};

// @desc    Get aptitude test details by ID
// @route   GET /api/recruiter/test/:id
// @access  Private (Recruiter)
const getTestDetails = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const test = await AptitudeTest.findById(req.params.id)
      .populate("questionIds")
      .populate("driveId", "title description ctc minCGPA");

    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Aptitude test not found",
      });
    }

    if (test.recruiterId.toString() !== recruiter._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this test",
      });
    }

    return res.status(200).json({
      success: true,
      test,
      data: test,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch test details",
      error: error.message,
    });
  }
};

// @desc    Get aptitude test results and question-wise accuracy stats
// @route   GET /api/recruiter/test/:id/results
// @access  Private (Recruiter)
const getTestResults = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const test = await AptitudeTest.findById(req.params.id).populate("questionIds");
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Aptitude test not found",
      });
    }

    if (test.recruiterId.toString() !== recruiter._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view results for this test",
      });
    }

    // Fetch all TestAttempt records for this test
    const attempts = await TestAttempt.find({ testId: test._id })
      .populate({
        path: "studentId",
        populate: { path: "userId", select: "name email rollNumber" },
      })
      .sort({ score: -1, submittedAt: 1 });

    // Compute question-wise accuracy statistics
    const questionStats = test.questionIds.map((q) => {
      let totalAttemptsForQuestion = 0;
      let correctAttempts = 0;

      for (const attempt of attempts) {
        if (!attempt.questionOrder || attempt.questionOrder.length === 0) continue;

        // Find index of this question in the attempt's questionOrder
        const qIndex = attempt.questionOrder.findIndex(
          (qId) => qId.toString() === q._id.toString()
        );

        if (qIndex !== -1) {
          totalAttemptsForQuestion++;
          const candidateAnswer = attempt.answers ? attempt.answers[qIndex] : null;
          if (candidateAnswer !== null && candidateAnswer !== undefined) {
            const order = (attempt.optionOrder && attempt.optionOrder[qIndex]) || [0, 1, 2, 3];
            const chosenOriginalIndex = order[candidateAnswer];
            if (chosenOriginalIndex === q.correctOption) {
              correctAttempts++;
            }
          }
        }
      }

      const accuracyPercentage =
        totalAttemptsForQuestion > 0
          ? Math.round((correctAttempts / totalAttemptsForQuestion) * 100 * 10) / 10
          : 0;

      return {
        questionId: q._id,
        questionText: q.questionText,
        options: q.options || [],
        category: q.category,
        difficulty: q.difficulty,
        correctOption: q.correctOption,
        correctAnswerText: (q.options && q.options[q.correctOption]) || `Option ${['A','B','C','D'][q.correctOption]}`,
        totalAttempts: totalAttemptsForQuestion,
        correctAttempts,
        accuracyPercentage,
      };
    });

    const passedCount = attempts.filter((a) => a.result === "Pass").length;
    const failedCount = attempts.filter((a) => a.result === "Fail").length;

    return res.status(200).json({
      success: true,
      testId: test._id,
      title: test.title,
      passingScore: test.passingScore,
      totalAttempts: attempts.length,
      passedCount,
      failedCount,
      questionStats,
      attempts,
      data: {
        attempts,
        questionStats,
        summary: {
          total: attempts.length,
          passed: passedCount,
          failed: failedCount,
        },
      },
    });
  } catch (error) {
    console.error("[AptitudeTestController] getTestResults error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch test results",
      error: error.message,
    });
  }
};

// @desc    Get all aptitude tests created by the recruiter
// @route   GET /api/recruiter/tests
// @access  Private (Recruiter)
const getRecruiterTests = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const tests = await AptitudeTest.find({ recruiterId: recruiter._id })
      .populate("driveId", "title description ctc status")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tests.length,
      tests,
      data: tests,
    });
  } catch (error) {
    console.error("[AptitudeTestController] getRecruiterTests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch aptitude tests",
      error: error.message,
    });
  }
};

module.exports = {
  createTest,
  publishTest,
  getTestDetails,
  getTestResults,
  getRecruiterTests,
};

