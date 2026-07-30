const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruiter",
      required: true,
    },
    driveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDrive",
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },
    eventType: {
      type: String,
      enum: ["Aptitude", "GD", "Interview"],
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      default: "Online",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled"],
      default: "Scheduled",
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index for Conflict Detection (per TABLE DESIGN.docx)
scheduleSchema.index(
  { studentId: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: "Scheduled" } }
);
scheduleSchema.index({ recruiterId: 1 });

module.exports = mongoose.model("Schedule", scheduleSchema);
