const mongoose = require("mongoose");

const recruiterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
    },
    coverNote: {
      type: String,
      trim: true,
      default: null,
    },
    website: {
      type: String,
      trim: true,
      default: null,
    },
    officialEmail: {
      type: String,
      required: [true, "Official email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    companyLogo: {
      type: String,
      default: null,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "OnHold"],
      default: "Pending",
    },
    registrationStatus: {
      type: String,
      enum: ["pending", "approved", "on_hold"],
      default: "pending",
    },
    holdFeedback: {
      message: { type: String, default: "" },
      suggestions: { type: String, default: "" },
      providedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      providedAt: { type: Date, default: null },
    },
    lastEditedAt: { type: Date, default: null },
    trustScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    verificationDetails: {
      breakdown: {
        domainAge: { type: Number, default: 0 },
        emailMatch: { type: Number, default: 0 },
        mca: { type: Number, default: 0 },
      },
      whoisData: {
        domain: { type: String, default: null },
        creationDate: { type: String, default: null },
        domainAgeYears: { type: Number, default: null },
        registrar: { type: String, default: null },
        registrantCountry: { type: String, default: null },
        isValid: { type: Boolean, default: false },
      },
      mcaData: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      directors: {
        type: Array,
        default: [],
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
    },
    tpoSuggestions: [
      {
        suggestion: { type: String, required: true },
        sentAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Recruiter", recruiterSchema);
