const mongoose = require("mongoose");

const testAttemptSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AptitudeTest",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    questionOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuestionBank",
      },
    ],
    optionOrder: {
      type: [[Number]],
      default: [],
    },
    answers: {
      type: [Number],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    result: {
      type: String,
      enum: ["Pass", "Fail", "Pending"],
      default: "Pending",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    autoSubmitted: {
      type: Boolean,
      default: false,
    },
    violationCount: {
      type: Number,
      default: 0,
    },
    violationLog: {
      type: [Object],
      default: [],
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    lastSavedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

testAttemptSchema.index({ testId: 1, studentId: 1 }, { unique: true });
testAttemptSchema.index({ applicationId: 1 });

module.exports = mongoose.model("TestAttempt", testAttemptSchema);
