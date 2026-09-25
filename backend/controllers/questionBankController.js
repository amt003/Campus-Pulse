const QuestionBank = require("../models/QuestionBank");
const Recruiter = require("../models/Recruiter");

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

module.exports = {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
};
