const mongoose = require("mongoose");

const resumeParseSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    resumeFileId: {
      type: String, // GridFS file ID
      required: true,
    },
    parsedText: {
      type: String,
      required: true,
    },
    parsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

resumeParseSchema.index({ studentId: 1 });

module.exports = mongoose.model("ResumeParse", resumeParseSchema);
