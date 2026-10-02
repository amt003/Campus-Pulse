const TestAttempt = require("../models/TestAttempt");
const AptitudeTest = require("../models/AptitudeTest");
const QuestionBank = require("../models/QuestionBank");
const Application = require("../models/Application");
const Student = require("../models/Student");
const Schedule = require("../models/Schedule");

// Helper to get authenticated student profile
const getAuthenticatedStudent = async (userId) => {
  return await Student.findOne({ userId });
};

// Helper to shuffle an array (Fisher-Yates)
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Helper to parse scheduled date and timeSlot string into { startTime, endTime } Date objects
const parseTimeSlotWindow = (scheduledDate, timeSlotStr, durationMinutes = 60) => {
  if (!scheduledDate) return { startTime: null, endTime: null };
  const baseDate = new Date(scheduledDate);
  if (isNaN(baseDate.getTime())) return { startTime: null, endTime: null };
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  if (!timeSlotStr || typeof timeSlotStr !== "string" || !timeSlotStr.trim()) {
    return {
      startTime: new Date(year, month, day, 0, 0, 0, 0),
      endTime: new Date(year, month, day, 23, 59, 59, 999),
    };
  }

  const cleanSlot = timeSlotStr.trim();
  const parts = cleanSlot.split(/\s*(?:-|–|—|to)\s*/i);

  const parseTimePart = (str, defaultAmPm = null) => {
    if (!str) return null;
    const s = str.trim().toUpperCase();
    const isPM = s.includes("PM");
    const isAM = s.includes("AM");
    const cleanStr = s.replace(/AM|PM/gi, "").trim();

    const colonParts = cleanStr.split(":");
    let hour = parseInt(colonParts[0], 10);
    let minute = colonParts.length > 1 ? parseInt(colonParts[1], 10) : 0;

    if (isNaN(hour)) return null;
    if (isNaN(minute)) minute = 0;

    if (isPM) {
      if (hour < 12) hour += 12;
    } else if (isAM) {
      if (hour === 12) hour = 0;
    } else if (defaultAmPm) {
      if (defaultAmPm === "PM" && hour < 12) hour += 12;
      if (defaultAmPm === "AM" && hour === 12) hour = 0;
    }

    return { hour, minute };
  };

  let startParsed = null;
  let endParsed = null;

  if (parts.length >= 2) {
    const endHasAM = parts[1].toUpperCase().includes("AM");
    const endHasPM = parts[1].toUpperCase().includes("PM");
    const defaultAmPm = endHasPM ? "PM" : endHasAM ? "AM" : null;
    startParsed = parseTimePart(parts[0], defaultAmPm);
    endParsed = parseTimePart(parts[1], null);
  } else {
    startParsed = parseTimePart(parts[0], null);
  }

  if (!startParsed) {
    return {
      startTime: new Date(year, month, day, 0, 0, 0, 0),
      endTime: new Date(year, month, day, 23, 59, 59, 999),
    };
  }

  const startTime = new Date(year, month, day, startParsed.hour, startParsed.minute, 0, 0);
  let endTime;

  if (endParsed) {
    endTime = new Date(year, month, day, endParsed.hour, endParsed.minute, 0, 0);
    if (endTime <= startTime) {
      endTime = new Date(startTime.getTime() + (durationMinutes || 60) * 60 * 1000);
    }
  } else {
    endTime = new Date(startTime.getTime() + (durationMinutes || 60) * 60 * 1000);
  }

  return { startTime, endTime };
};

// Helper to compute evaluation & update application
const evaluateAndFinalizeAttempt = async (attempt, test, submittedAnswers = null, isAuto = false) => {
  if (submittedAnswers && Array.isArray(submittedAnswers)) {
    attempt.answers = submittedAnswers;
  }

  const questions = await QuestionBank.find({ _id: { $in: attempt.questionOrder } });
  const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

  let correctCount = 0;
  const sections = {};

  for (let i = 0; i < attempt.questionOrder.length; i++) {
    const qId = attempt.questionOrder[i].toString();
    const q = questionMap.get(qId);
    if (!q) continue;

    if (!sections[q.category]) {
      sections[q.category] = { total: 0, correct: 0 };
    }
    sections[q.category].total++;

    const studentAnswerIndex = attempt.answers[i];
    if (studentAnswerIndex !== null && studentAnswerIndex !== undefined) {
      const order = attempt.optionOrder[i] || [0, 1, 2, 3];
      const chosenOriginalIndex = order[studentAnswerIndex];
      if (chosenOriginalIndex === q.correctOption) {
        correctCount++;
        sections[q.category].correct++;
      }
    }
  }

  const totalQuestions = attempt.questionOrder.length;
  const score = correctCount;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100 * 10) / 10 : 0;
  const result = percentage >= (test.passingScore || 0) ? "Pass" : "Fail";

  attempt.score = score;
  attempt.totalQuestions = totalQuestions;
  attempt.percentage = percentage;
  attempt.result = result;
  attempt.submittedAt = new Date();
  if (isAuto) {
    attempt.autoSubmitted = true;
  }
  await attempt.save();

  // Update Application's aptitude sub-document and overall status
  const application = await Application.findById(attempt.applicationId);
  if (application) {
    const isPass = result === "Pass";
    application.status = isPass ? "Aptitude Completed" : "Rejected";
    if (!application.aptitude) {
      application.aptitude = {};
    }
    application.aptitude.status = isPass ? "Passed" : "Failed";
    application.aptitude.score = percentage;
    application.aptitude.source = "in_house";
    application.aptitude.markedAt = new Date();

    if (attempt.autoSubmitted && attempt.violationCount > 0) {
      application.aptitude.feedback = `Auto-submitted due to ${attempt.violationCount} proctoring violation(s) (Score: ${percentage}%, Passing Cutoff: ${test.passingScore || 0}%)`;
    } else {
      application.aptitude.feedback = isPass
        ? `Passed In-House Aptitude Test (Score: ${percentage}%, Passing Cutoff: ${test.passingScore || 0}%)`
        : `Below Cutoff Score in In-House Aptitude Test (Score: ${percentage}%, Passing Cutoff: ${test.passingScore || 0}%)`;
    }

    await application.save();
  }

  // Increment timesUsed on each question in this attempt
  await QuestionBank.updateMany(
    { _id: { $in: attempt.questionOrder } },
    { $inc: { timesUsed: 1 } }
  );

  const sectionWiseBreakdown = Object.entries(sections).map(([name, data]) => ({
    category: name,
    total: data.total,
    correct: data.correct,
    percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));

  return {
    score,
    totalQuestions,
    percentage,
    result,
    sectionWiseBreakdown,
  };
};

// @desc    Get upcoming active tests for drives the student applied to
// @route   GET /api/student/test/upcoming
// @access  Private (Student)
const getUpcomingTests = async (req, res) => {
  try {
    const student = await getAuthenticatedStudent(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    // Find all applications of this student
    const applications = await Application.find({ studentId: student._id });
    const driveIds = applications.map((a) => a.driveId);

    // Find active tests for these drives
    const activeTests = await AptitudeTest.find({
      driveId: { $in: driveIds },
      status: "Active",
    }).populate("driveId", "title description ctc");

    const testsWithAttemptStatus = await Promise.all(
      activeTests.map(async (test) => {
        const attempt = await TestAttempt.findOne({
          testId: test._id,
          studentId: student._id,
        });

        let attemptStatus = "Not Started";
        if (attempt) {
          attemptStatus = attempt.submittedAt ? "Submitted" : "In Progress";
        }

        const app = applications.find(
          (a) => a.driveId.toString() === (test.driveId._id || test.driveId).toString()
        );

        const candidateSchedule = await Schedule.findOne({
          studentId: student._id,
          driveId: test.driveId._id || test.driveId,
          eventType: "Aptitude",
          status: "Scheduled",
        });

        const targetDate = candidateSchedule?.date || test.scheduledDate;
        const targetTimeSlot = candidateSchedule?.timeSlot || test.timeSlot;
        const { startTime, endTime } = parseTimeSlotWindow(targetDate, targetTimeSlot, test.durationMinutes);

        const now = new Date();
        const isTimeLocked = Boolean(startTime && now < startTime);
        const isExpired = Boolean(endTime && now > endTime && attemptStatus !== "In Progress");

        return {
          _id: test._id,
          title: test.title,
          durationMinutes: test.durationMinutes,
          passingScore: test.passingScore,
          scheduledDate: targetDate || test.scheduledDate,
          timeSlot: targetTimeSlot || test.timeSlot,
          isTimeLocked,
          isExpired,
          antiCheatEnabled: test.antiCheatEnabled,
          maxViolations: test.maxViolations,
          drive: test.driveId,
          applicationStatus: app ? app.status : null,
          attemptStatus,
          hasAttempted: attempt ? Boolean(attempt.submittedAt) : false,
          attemptId: attempt ? attempt._id : null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: testsWithAttemptStatus.length,
      tests: testsWithAttemptStatus,
      data: testsWithAttemptStatus,
    });
  } catch (error) {
    console.error("[TestAttemptController] getUpcomingTests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming tests",
      error: error.message,
    });
  }
};

// @desc    Start or resume an aptitude test
// @route   GET /api/student/test/:id/start
// @access  Private (Student)
const startTest = async (req, res) => {
  try {
    const student = await getAuthenticatedStudent(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const test = await AptitudeTest.findById(req.params.id);
    if (!test || test.status !== "Active") {
      return res.status(404).json({
        success: false,
        message: "Aptitude test is not currently active or found",
      });
    }

    // 1. Verify student has an application for this drive and is eligible
    const application = await Application.findOne({
      studentId: student._id,
      driveId: test.driveId,
    });

    if (!application) {
      return res.status(403).json({
        success: false,
        message: "You have not applied for this drive",
      });
    }

    if (["Rejected", "Offer Declined"].includes(application.status)) {
      return res.status(403).json({
        success: false,
        message: "You are not eligible to take this test",
      });
    }

    // 2. Enforce scheduled date & timeSlot entry window
    const candidateSchedule = await Schedule.findOne({
      studentId: student._id,
      driveId: test.driveId,
      eventType: "Aptitude",
      status: "Scheduled",
    });

    const targetDate = candidateSchedule?.date || test.scheduledDate;
    const targetTimeSlot = candidateSchedule?.timeSlot || test.timeSlot;

    if (targetDate) {
      const { startTime, endTime } = parseTimeSlotWindow(targetDate, targetTimeSlot, test.durationMinutes);
      const now = new Date();

      if (startTime && now < startTime) {
        const timeStr = targetTimeSlot || new Date(startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateStr = new Date(startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return res.status(403).json({
          success: false,
          isTimeLocked: true,
          message: `This test has not opened yet. It is scheduled for ${dateStr} at ${timeStr}. Candidate can only enter at the scheduled test time.`,
        });
      }

      // Check existing attempt to allow resuming in-progress attempts
      let attempt = await TestAttempt.findOne({
        testId: test._id,
        studentId: student._id,
      });

      const isAttemptInProgress = attempt && !attempt.submittedAt;

      if (endTime && now > endTime && !isAttemptInProgress) {
        return res.status(403).json({
          success: false,
          isExpired: true,
          message: `The time window for this test has expired (${targetTimeSlot || "Expired"}). Candidate cannot enter after the scheduled time limit.`,
        });
      }
    }

    // 3. Check existing attempt (Resume or reject if already submitted)
    let attempt = await TestAttempt.findOne({
      testId: test._id,
      studentId: student._id,
    });

    if (attempt && attempt.submittedAt) {
      return res.status(400).json({
        success: false,
        message: "You have already completed and submitted this test. Multiple attempts are not permitted.",
        attemptId: attempt._id,
        submittedAt: attempt.submittedAt,
        result: attempt.result,
      });
    }

    // Load question documents
    const questions = await QuestionBank.find({ _id: { $in: test.questionIds } });
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    if (!attempt) {
      // Create new attempt
      let questionOrderIds = [...test.questionIds];
      if (test.shuffleQuestions) {
        questionOrderIds = shuffleArray(questionOrderIds);
      }

      // Generate optionOrder for each question
      const optionOrder = questionOrderIds.map(() => {
        if (test.shuffleOptions) {
          return shuffleArray([0, 1, 2, 3]);
        }
        return [0, 1, 2, 3];
      });

      const initialAnswers = new Array(questionOrderIds.length).fill(null);

      attempt = await TestAttempt.create({
        testId: test._id,
        studentId: student._id,
        applicationId: application._id,
        questionOrder: questionOrderIds,
        optionOrder,
        answers: initialAnswers,
        score: 0,
        totalQuestions: questionOrderIds.length,
        percentage: 0,
        result: "Pending",
        startedAt: new Date(),
        submittedAt: null,
        autoSubmitted: false,
        violationCount: 0,
        violationLog: [],
        flagged: false,
        lastSavedAt: new Date(),
      });
    }

    // Calculate deadline
    const deadline = new Date(
      new Date(attempt.startedAt).getTime() + test.durationMinutes * 60 * 1000
    );

    // Format questions: STRICTLY STRIP OUT correctOption
    const sanitizedQuestions = attempt.questionOrder.map((qId, qIdx) => {
      const q = questionMap.get(qId.toString());
      if (!q) return null;

      const order = attempt.optionOrder[qIdx] || [0, 1, 2, 3];
      const displayOptions = order.map((originalIndex) => q.options[originalIndex]);

      return {
        _id: q._id,
        questionText: q.questionText,
        category: q.category,
        difficulty: q.difficulty,
        options: displayOptions,
        // Notice: correctOption is NEVER returned to client
      };
    }).filter(Boolean);

    return res.status(200).json({
      success: true,
      message: attempt.submittedAt ? "Test resumed" : "Test started successfully",
      attemptId: attempt._id,
      deadline,
      serverTime: new Date(),
      durationMinutes: test.durationMinutes,
      antiCheatEnabled: test.antiCheatEnabled,
      maxViolations: test.maxViolations,
      violationCount: attempt.violationCount,
      totalQuestions: sanitizedQuestions.length,
      savedAnswers: attempt.answers,
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error("[TestAttemptController] startTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start test",
      error: error.message,
    });
  }
};

// @desc    Save candidate answers in progress
// @route   POST /api/student/test/attempt/:attemptId/save
// @access  Private (Student)
const saveAnswers = async (req, res) => {
  try {
    const student = await getAuthenticatedStudent(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Test attempt not found",
      });
    }

    if (attempt.studentId.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this test attempt",
      });
    }

    if (attempt.submittedAt) {
      return res.status(400).json({
        success: false,
        message: "Cannot save answers: test has already been submitted",
      });
    }

    const { answers } = req.body;
    if (answers && Array.isArray(answers)) {
      attempt.answers = answers;
      attempt.lastSavedAt = new Date();
      await attempt.save();
    }

    return res.status(200).json({
      success: true,
      message: "Answers saved successfully",
      lastSavedAt: attempt.lastSavedAt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to save answers",
      error: error.message,
    });
  }
};

// @desc    Submit an aptitude test attempt and evaluate score
// @route   POST /api/student/test/attempt/:attemptId/submit
// @access  Private (Student)
const submitTest = async (req, res) => {
  try {
    const student = await getAuthenticatedStudent(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Test attempt not found",
      });
    }

    if (attempt.studentId.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to submit this attempt",
      });
    }

    if (attempt.submittedAt) {
      return res.status(400).json({
        success: false,
        message: "This test attempt has already been submitted",
      });
    }

    const test = await AptitudeTest.findById(attempt.testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Aptitude test not found",
      });
    }

    const { answers, autoSubmitted = false } = req.body;

    const evaluation = await evaluateAndFinalizeAttempt(
      attempt,
      test,
      answers,
      autoSubmitted
    );

    return res.status(200).json({
      success: true,
      message: "Test submitted successfully",
      score: evaluation.score,
      totalQuestions: evaluation.totalQuestions,
      percentage: evaluation.percentage,
      result: evaluation.result,
      passingScore: test.passingScore,
      sectionWiseBreakdown: evaluation.sectionWiseBreakdown,
      // Never returns correctOption or correct answers
    });
  } catch (error) {
    console.error("[TestAttemptController] submitTest error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit test",
      error: error.message,
    });
  }
};

// @desc    Get result of a completed attempt for the logged-in student
// @route   GET /api/student/test/attempt/:attemptId/result
// @access  Private (Student)
const getMyResult = async (req, res) => {
  try {
    const student = await getAuthenticatedStudent(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Test attempt not found",
      });
    }

    if (attempt.studentId.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this result",
      });
    }

    if (!attempt.submittedAt || attempt.result === "Pending") {
      return res.status(400).json({
        success: false,
        message: "Test has not been submitted yet",
      });
    }

    const test = await AptitudeTest.findById(attempt.testId).populate("driveId", "title");

    // Compute section-wise breakdown
    const questions = await QuestionBank.find({ _id: { $in: attempt.questionOrder } });
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    const sections = {};
    for (let i = 0; i < attempt.questionOrder.length; i++) {
      const q = questionMap.get(attempt.questionOrder[i].toString());
      if (!q) continue;

      if (!sections[q.category]) {
        sections[q.category] = { total: 0, correct: 0 };
      }
      sections[q.category].total++;

      const studentAnswerIndex = attempt.answers[i];
      if (studentAnswerIndex !== null && studentAnswerIndex !== undefined) {
        const order = attempt.optionOrder[i] || [0, 1, 2, 3];
        if (order[studentAnswerIndex] === q.correctOption) {
          sections[q.category].correct++;
        }
      }
    }

    const sectionWiseBreakdown = Object.entries(sections).map(([name, data]) => ({
      category: name,
      total: data.total,
      correct: data.correct,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }));

    return res.status(200).json({
      success: true,
      testTitle: test ? test.title : "Aptitude Test",
      driveTitle: test && test.driveId ? test.driveId.title : null,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      percentage: attempt.percentage,
      result: attempt.result,
      passingScore: test ? test.passingScore : null,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
      violationCount: attempt.violationCount,
      sectionWiseBreakdown,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch test result",
      error: error.message,
    });
  }
};

// @desc    Log anti-cheat violation and auto-submit if threshold exceeded
// @route   POST /api/student/test/attempt/:attemptId/violation
// @access  Private (Student)
const logViolation = async (req, res) => {
  try {
    const student = await getAuthenticatedStudent(req.user._id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: "Test attempt not found",
      });
    }

    if (attempt.studentId.toString() !== student._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to log violation on this attempt",
      });
    }

    if (attempt.submittedAt) {
      return res.status(400).json({
        success: false,
        message: "Test is already submitted",
      });
    }

    const test = await AptitudeTest.findById(attempt.testId);
    if (!test) {
      return res.status(404).json({
        success: false,
        message: "Test not found",
      });
    }

    const { type = "tab_switch", details = "Proctoring violation detected" } = req.body;

    attempt.violationLog.push({
      type,
      timestamp: new Date(),
      details,
    });
    attempt.violationCount += 1;

    const maxAllowed = test.maxViolations || 3;

    if (attempt.violationCount >= maxAllowed) {
      attempt.flagged = true;
      // Trigger automatic submission
      const evaluation = await evaluateAndFinalizeAttempt(
        attempt,
        test,
        attempt.answers,
        true // isAuto: true
      );

      return res.status(200).json({
        success: true,
        autoSubmitted: true,
        message: `Violation limit (${maxAllowed}) reached. Your test has been automatically submitted.`,
        violationCount: attempt.violationCount,
        score: evaluation.score,
        percentage: evaluation.percentage,
        result: evaluation.result,
        sectionWiseBreakdown: evaluation.sectionWiseBreakdown,
      });
    }

    await attempt.save();

    return res.status(200).json({
      success: true,
      autoSubmitted: false,
      message: `Violation logged: ${type}`,
      violationCount: attempt.violationCount,
      violationsRemaining: maxAllowed - attempt.violationCount,
    });
  } catch (error) {
    console.error("[TestAttemptController] logViolation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to log violation",
      error: error.message,
    });
  }
};

module.exports = {
  getUpcomingTests,
  startTest,
  saveAnswers,
  submitTest,
  getMyResult,
  logViolation,
};
