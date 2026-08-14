const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    driveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDrive",
      required: true,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: [
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
      ],
      default: "Applied",
    },
    aiMatchScore: {
      type: Number,
      default: null,
    },
    aptitude: {
      status: {
        type: String,
        enum: ["Scheduled", "Completed", "Passed", "Failed", "Not Applicable"],
        default: "Not Applicable",
      },
      score: { type: Number, default: null },
      feedback: { type: String, default: null },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Recruiter", default: null },
      markedAt: { type: Date, default: null },
    },
    gd: {
      status: {
        type: String,
        enum: ["Scheduled", "Completed", "Shortlisted", "Rejected", "Not Applicable"],
        default: "Not Applicable",
      },
      score: { type: Number, default: null },
      feedback: { type: String, default: null },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Recruiter", default: null },
      markedAt: { type: Date, default: null },
    },
    interview: {
      status: {
        type: String,
        enum: ["Scheduled", "Completed", "Pending"],
        default: "Pending",
      },
      result: {
        type: String,
        enum: ["Selected", "Rejected", "Waitlisted", "Pending"],
        default: "Pending",
      },
      score: { type: Number, default: null },
      feedback: { type: String, default: null },
      markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Recruiter", default: null },
      markedAt: { type: Date, default: null },
    },
    xai: {
      matchScore: { type: Number, default: null },
      positiveSentences: [{ type: String }],
      negativeSentences: [{ type: String }],
      skillGaps: [{ type: String }],
      strongSkills: [{ type: String }],
      isOfflineFallback: { type: Boolean, default: false },
    },
    offer: {
      status: {
        type: String,
        enum: ["Sent", "Viewed", "Downloaded", "Accepted", "Declined", "Expired", "Not Sent"],
        default: "Not Sent",
      },
      fileId: { type: String, default: null },
      filePath: { type: String, default: null },
      fileName: { type: String, default: null },
      uploadedDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      viewedAt: { type: Date, default: null },
      downloadedAt: { type: Date, default: null },
      acceptedAt: { type: Date, default: null },
      declinedAt: { type: Date, default: null },
      declineReason: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes specified in TABLE DESIGN.docx
applicationSchema.index({ studentId: 1, driveId: 1 }, { unique: true });
applicationSchema.index({ driveId: 1, status: 1, aiMatchScore: -1 });

module.exports = mongoose.model("Application", applicationSchema);
