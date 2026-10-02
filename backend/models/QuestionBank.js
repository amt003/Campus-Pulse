const mongoose = require("mongoose");

const questionBankSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruiter",
      default: null,
    },
    questionText: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
    },
    options: {
      type: [String],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length === 4;
        },
        message: "Options must contain exactly 4 choices",
      },
      required: [true, "Options array of 4 choices is required"],
    },
    correctOption: {
      type: Number,
      required: [true, "Correct option index (0-3) is required"],
      min: 0,
      max: 3,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    category: {
      type: String,
      enum: ["Quantitative", "Logical", "Verbal", "Technical"],
      required: [true, "Category is required"],
    },
    source: {
      type: String,
      enum: ["manual", "ai_generated", "curated", "pdf_upload"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["draft", "approved", "rejected"],
      default: "draft",
    },
    timesUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

questionBankSchema.index({ recruiterId: 1, category: 1, difficulty: 1 });
questionBankSchema.index({ status: 1 });

module.exports = mongoose.model("QuestionBank", questionBankSchema);
