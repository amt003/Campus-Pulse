const mongoose = require("mongoose");

const recruiterTrustScoreSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recruiter",
      required: true,
      unique: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    whoisData: {
      type: Object,
      default: {},
    },
    mcaData: {
      type: Object,
      default: {},
    },
    trustScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index defined via unique: true on recruiterId field
module.exports = mongoose.model("RecruiterTrustScore", recruiterTrustScoreSchema);
