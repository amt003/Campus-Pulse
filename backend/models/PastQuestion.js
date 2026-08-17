const mongoose = require("mongoose");

const pastQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Question text is required"],
      trim: true,
    },
    questionType: {
      type: String,
      enum: ["Technical", "HR", "Aptitude", "GD"],
      default: "Technical",
    },
    year: {
      type: Number,
      default: new Date().getFullYear(),
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "pastquestions",
  }
);

pastQuestionSchema.index({ companyName: 1 });

module.exports = mongoose.model("PastQuestion", pastQuestionSchema);
