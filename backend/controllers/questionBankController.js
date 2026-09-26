const QuestionBank = require("../models/QuestionBank");
const Recruiter = require("../models/Recruiter");
const { generateQuestions } = require("../services/questionGeneratorService");

// Helper to get authenticated recruiter profile
const getAuthenticatedRecruiter = async (userId) => {
  return await Recruiter.findOne({ userId });
};

// @desc    Add a manual question to QuestionBank
// @route   POST /api/recruiter/question
// @access  Private (Recruiter)
const addQuestion = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const { questionText, options, correctOption, difficulty, category } = req.body;

    if (!questionText || typeof questionText !== "string" || !questionText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Question text is required",
      });
    }

    if (!Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({
        success: false,
        message: "Options must contain exactly 4 choices",
      });
    }

    if (
      correctOption === undefined ||
      correctOption === null ||
      typeof correctOption !== "number" ||
      correctOption < 0 ||
      correctOption > 3
    ) {
      return res.status(400).json({
        success: false,
        message: "Correct option index must be a number between 0 and 3",
      });
    }

    const validCategories = ["Quantitative", "Logical", "Verbal", "Technical"];
    const matchedCategory = validCategories.find(
      (c) => c.toLowerCase() === (category || "").trim().toLowerCase()
    );
    if (!matchedCategory) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${validCategories.join(", ")}`,
      });
    }

    const validDifficulties = ["Easy", "Medium", "Hard"];
    const matchedDifficulty = validDifficulties.find(
      (d) => d.toLowerCase() === (difficulty || "Medium").trim().toLowerCase()
    ) || "Medium";

    const newQuestion = await QuestionBank.create({
      recruiterId: recruiter._id,
      questionText: questionText.trim(),
      options: options.map((opt) => String(opt).trim()),
      correctOption,
      difficulty: matchedDifficulty,
      category: matchedCategory,
      source: "manual",
      status: "approved",
      timesUsed: 0,
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Question created successfully",
      question: newQuestion,
      data: newQuestion,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to add question",
      error: error.message,
    });
  }
};

// @desc    Get questions created by the logged-in recruiter with optional filters
// @route   GET /api/recruiter/questions
// @access  Private (Recruiter)
const getQuestions = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const query = { recruiterId: recruiter._id };

    if (req.query.status) {
      if (req.query.status !== "all") {
        query.status = req.query.status.trim();
      }
    } else {
      query.status = "approved";
    }

    if (req.query.category) {
      const validCategories = ["Quantitative", "Logical", "Verbal", "Technical"];
      const matched = validCategories.find(
        (c) => c.toLowerCase() === req.query.category.trim().toLowerCase()
      );
      if (matched) {
        query.category = matched;
      }
    }

    if (req.query.difficulty) {
      const validDifficulties = ["Easy", "Medium", "Hard"];
      const matched = validDifficulties.find(
        (d) => d.toLowerCase() === req.query.difficulty.trim().toLowerCase()
      );
      if (matched) {
        query.difficulty = matched;
      }
    }

    if (req.query.source) {
      query.source = req.query.source.trim();
    }

    const questions = await QuestionBank.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: questions.length,
      questions,
      data: questions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch questions",
      error: error.message,
    });
  }
};

// @desc    Update a question owned by the logged-in recruiter
// @route   PUT /api/recruiter/question/:id
// @access  Private (Recruiter)
const updateQuestion = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Ownership check
    if (
      !question.recruiterId ||
      question.recruiterId.toString() !== recruiter._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to edit this question",
      });
    }

    const { questionText, options, correctOption, difficulty, category } = req.body;

    if (questionText !== undefined) {
      if (typeof questionText !== "string" || !questionText.trim()) {
        return res.status(400).json({
          success: false,
          message: "Question text cannot be empty",
        });
      }
      question.questionText = questionText.trim();
    }

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length !== 4) {
        return res.status(400).json({
          success: false,
          message: "Options must contain exactly 4 choices",
        });
      }
      question.options = options.map((opt) => String(opt).trim());
    }

    if (correctOption !== undefined) {
      if (
        typeof correctOption !== "number" ||
        correctOption < 0 ||
        correctOption > 3
      ) {
        return res.status(400).json({
          success: false,
          message: "Correct option index must be a number between 0 and 3",
        });
      }
      question.correctOption = correctOption;
    }

    if (difficulty !== undefined) {
      const validDifficulties = ["Easy", "Medium", "Hard"];
      const matched = validDifficulties.find(
        (d) => d.toLowerCase() === difficulty.trim().toLowerCase()
      );
      if (!matched) {
        return res.status(400).json({
          success: false,
          message: `Difficulty must be one of: ${validDifficulties.join(", ")}`,
        });
      }
      question.difficulty = matched;
    }

    if (category !== undefined) {
      const validCategories = ["Quantitative", "Logical", "Verbal", "Technical"];
      const matched = validCategories.find(
        (c) => c.toLowerCase() === category.trim().toLowerCase()
      );
      if (!matched) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${validCategories.join(", ")}`,
        });
      }
      question.category = matched;
    }

    await question.save();

    return res.status(200).json({
      success: true,
      message: "Question updated successfully",
      question,
      data: question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update question",
      error: error.message,
    });
  }
};

// @desc    Delete a question owned by the logged-in recruiter
// @route   DELETE /api/recruiter/question/:id
// @access  Private (Recruiter)
const deleteQuestion = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    // Ownership check
    if (
      !question.recruiterId ||
      question.recruiterId.toString() !== recruiter._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this question",
      });
    }

    await QuestionBank.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete question",
      error: error.message,
    });
  }
};

// @desc    Generate AI draft questions using Gemini 1.5 Flash
// @route   POST /api/recruiter/question/generate
// @access  Private (Recruiter)
const generateDraftQuestions = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const { count = 5, category = "Quantitative", difficulty = "Easy", apiKey } = req.body;

    const questions = await generateQuestions({
      count,
      category,
      difficulty,
      recruiterId: recruiter._id,
      apiKey,
    });

    return res.status(201).json({
      success: true,
      message: `Generated ${questions.length} draft questions successfully`,
      count: questions.length,
      questions,
      data: questions,
    });
  } catch (error) {
    console.error("[QuestionBankController] generateDraftQuestions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate AI questions",
      error: error.message,
    });
  }
};

// @desc    Get all draft questions for the recruiter
// @route   GET /api/recruiter/question/drafts
// @access  Private (Recruiter)
const getDraftQuestions = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const query = {
      recruiterId: recruiter._id,
      status: "draft",
    };

    if (req.query.category) {
      query.category = req.query.category.trim();
    }
    if (req.query.difficulty) {
      query.difficulty = req.query.difficulty.trim();
    }

    const questions = await QuestionBank.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: questions.length,
      questions,
      data: questions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch draft questions",
      error: error.message,
    });
  }
};

// @desc    Approve a draft question
// @route   PUT /api/recruiter/question/:id/approve
// @access  Private (Recruiter)
const approveDraftQuestion = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (
      !question.recruiterId ||
      question.recruiterId.toString() !== recruiter._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this question",
      });
    }

    question.status = "approved";
    await question.save();

    return res.status(200).json({
      success: true,
      message: "Draft question approved successfully",
      question,
      data: question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve draft question",
      error: error.message,
    });
  }
};

// @desc    Reject a draft question
// @route   PUT /api/recruiter/question/:id/reject
// @access  Private (Recruiter)
const rejectDraftQuestion = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const question = await QuestionBank.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    if (
      !question.recruiterId ||
      question.recruiterId.toString() !== recruiter._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this question",
      });
    }

    question.status = "rejected";
    await question.save();

    return res.status(200).json({
      success: true,
      message: "Draft question rejected successfully",
      question,
      data: question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject draft question",
      error: error.message,
    });
  }
};

// @desc    Generate random questions from curated bank by category counts
// @route   POST /api/recruiter/test/generate-from-bank
// @access  Private (Recruiter)
const generateFromBank = async (req, res) => {
  try {
    const recruiter = await getAuthenticatedRecruiter(req.user._id);
    if (!recruiter) {
      return res.status(404).json({
        success: false,
        message: "Recruiter profile not found",
      });
    }

    const {
      quantitative = 0,
      logical = 0,
      verbal = 0,
      technical = 0,
    } = req.body;

    const categoryCounts = {
      Quantitative: Math.max(0, parseInt(quantitative, 10) || 0),
      Logical: Math.max(0, parseInt(logical, 10) || 0),
      Verbal: Math.max(0, parseInt(verbal, 10) || 0),
      Technical: Math.max(0, parseInt(technical, 10) || 0),
    };

    const totalRequested = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    if (totalRequested === 0) {
      return res.status(400).json({
        success: false,
        message: "Please specify at least one category with a count greater than 0",
      });
    }

    let selectedQuestions = [];

    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count <= 0) continue;

      const questions = await QuestionBank.aggregate([
        {
          $match: {
            recruiterId: null,
            source: "curated",
            status: "approved",
            category: category,
          },
        },
        { $sample: { size: count } },
      ]);

      selectedQuestions = selectedQuestions.concat(questions);
    }

    return res.status(200).json({
      success: true,
      count: selectedQuestions.length,
      questions: selectedQuestions,
      data: selectedQuestions,
    });
  } catch (error) {
    console.error("[QuestionBankController] generateFromBank error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate questions from bank",
      error: error.message,
    });
  }
};

module.exports = {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  generateDraftQuestions,
  getDraftQuestions,
  approveDraftQuestion,
  rejectDraftQuestion,
  generateFromBank,
};
