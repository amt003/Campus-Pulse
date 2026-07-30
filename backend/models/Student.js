const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    rollNumber: {
      type: String,
      required: [true, "Roll number is required"],
      unique: true,
      trim: true,
    },
    cgpa: {
      type: Number,
      required: [true, "CGPA is required"],
      min: 0,
      max: 10,
    },
    branch: {
      type: String,
      required: [true, "Branch is required"],
      trim: true,
    },
    passoutYear: {
      type: Number,
      required: [true, "Passout year is required"],
    },
    activeBacklogs: {
      type: Number,
      default: 0,
      min: 0,
    },
    resumePath: {
      type: String,
      default: null,
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Index defined via unique: true on field definitions
module.exports = mongoose.model("Student", studentSchema);
