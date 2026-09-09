const mongoose = require("mongoose");

const collegeConfigSchema = new mongoose.Schema(
  {
    seasonStart: {
      type: Date,
      required: [true, "Placement season start date is required"],
      default: () => new Date(new Date().getFullYear(), 7, 1), // Aug 1 of current year
    },
    seasonEnd: {
      type: Date,
      required: [true, "Placement season end date is required"],
      default: () => new Date(new Date().getFullYear(), 11, 15), // Dec 15 of current year
    },
    branches: {
      type: [String],
      default: ['BCA', 'MCA', 'INMCA', 'ECE', 'CSE', 'IT', 'EEE', 'ME', 'CE', 'AD'],
    },
    passoutYears: {
      type: [Number],
      default: [2024, 2025, 2026, 2027, 2028],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CollegeConfig", collegeConfigSchema);
