const mongoose = require("mongoose");

const aptitudeTestSchema = new mongoose.Schema(
  {
    driveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDrive",
      required: true,
    },
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruiter",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Test title is required"],
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: [true, "Duration in minutes is required"],
      min: 1,
    },
    questionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuestionBank",
      },
    ],
    passingScore: {
      type: Number,
      required: [true, "Passing score is required"],
      min: 0,
    },
    scheduledDate: {
      type: Date,
      default: null,
    },
    timeSlot: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Draft", "Active", "Closed"],
      default: "Draft",
    },
    generationMode: {
      type: String,
      enum: ["manual", "ai", "curated", "mixed"],
      default: "manual",
    },
    shuffleQuestions: {
      type: Boolean,
      default: true,
    },
    shuffleOptions: {
      type: Boolean,
      default: true,
    },
    antiCheatEnabled: {
      type: Boolean,
      default: true,
    },
    maxViolations: {
      type: Number,
      default: 3,
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

aptitudeTestSchema.index({ driveId: 1, status: 1 });
aptitudeTestSchema.index({ recruiterId: 1 });

module.exports = mongoose.model("AptitudeTest", aptitudeTestSchema);
