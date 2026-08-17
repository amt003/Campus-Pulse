const mongoose = require("mongoose");

const jobDriveSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    ctc: {
      type: Number,
      required: [true, "CTC is required"],
      min: 0,
    },
    minCGPA: {
      type: Number,
      required: [true, "Minimum CGPA is required"],
      min: 0,
      max: 10,
    },
    eligibleBranches: {
      type: [String],
      default: [],
    },
    maxBacklogs: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicationDeadline: {
      type: Date,
      required: [true, "Application deadline is required"],
    },
    hasAptitudeTest: {
      type: Boolean,
      default: false,
    },
    hasGD: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Draft", "Pending", "Open", "Closed", "Rejected", "OnHold"],
      default: "Pending",
    },
    attachments: [
      {
        fileName: { type: String, required: true },
        fileSize: { type: Number, required: true },
        fileUrl: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    tpoFeedback: {
      type: String,
      default: null
    },
    submittedForApprovalAt: {
      type: Date,
      default: null
    },
    resubmittedCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  },
);

jobDriveSchema.index({ recruiterId: 1, status: 1 });
jobDriveSchema.index({ applicationDeadline: 1 });

module.exports = mongoose.model("JobDrive", jobDriveSchema);
