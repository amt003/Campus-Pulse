const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    emailType: {
      type: String,
      enum: ["Activation", "Reminder", "Result", "Offer"],
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Sent", "Failed", "Opened", "Bounced"],
      default: "Sent",
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

emailLogSchema.index({ recipientEmail: 1 });
emailLogSchema.index({ status: 1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
