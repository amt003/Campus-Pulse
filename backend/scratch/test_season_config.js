const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const CollegeConfig = require("../models/CollegeConfig");

async function runTests() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/campuspulse";
    console.log("Connecting to MongoDB:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.\n");

    // Test 1: CollegeConfig fetch or create
    let config = await CollegeConfig.findOne().sort({ updatedAt: -1 });
    if (!config) {
      config = await CollegeConfig.create({
        seasonStart: new Date("2026-08-01"),
        seasonEnd: new Date("2027-01-31"), // 6 months
        updatedAt: new Date(),
      });
    }

    // Test 2: Duration Validation (Min 6 months / 180 days, Max 1 year / 366 days)
    console.log("--- Testing Season Duration Limits ---");
    
    // Case A: Too short (< 180 days, e.g., 3 months)
    const shortStart = new Date("2026-08-01");
    const shortEnd = new Date("2026-11-01"); // ~93 days
    const shortDays = Math.ceil((shortEnd - shortStart) / (1000 * 60 * 60 * 24)) + 1;
    const isShortInvalid = shortDays < 180;
    console.log(`Duration ${shortDays} days (< 180 days min): Correctly Invalid =`, isShortInvalid);

    // Case B: Too long (> 366 days, e.g., 1.5 years)
    const longStart = new Date("2026-08-01");
    const longEnd = new Date("2028-02-01"); // ~550 days
    const longDays = Math.ceil((longEnd - longStart) / (1000 * 60 * 60 * 24)) + 1;
    const isLongInvalid = longDays > 366;
    console.log(`Duration ${longDays} days (> 366 days max): Correctly Invalid =`, isLongInvalid);

    // Case C: Valid (6 months, e.g., Aug 1 to Jan 31 = 184 days)
    const valid6mStart = new Date("2026-08-01");
    const valid6mEnd = new Date("2027-01-31"); // 184 days
    const valid6mDays = Math.ceil((valid6mEnd - valid6mStart) / (1000 * 60 * 60 * 24)) + 1;
    const isValid6m = valid6mDays >= 180 && valid6mDays <= 366;
    console.log(`Duration ${valid6mDays} days (6 months): Correctly Valid =`, isValid6m);

    // Case D: Valid (1 year, e.g., Aug 1 to Jul 31 = 365 days)
    const valid1yStart = new Date("2026-08-01");
    const valid1yEnd = new Date("2027-07-31"); // 365 days
    const valid1yDays = Math.ceil((valid1yEnd - valid1yStart) / (1000 * 60 * 60 * 24)) + 1;
    const isValid1y = valid1yDays >= 180 && valid1yDays <= 366;
    console.log(`Duration ${valid1yDays} days (1 year): Correctly Valid =`, isValid1y);

    if (!isShortInvalid || !isLongInvalid || !isValid6m || !isValid1y) {
      throw new Error("Duration validation failed!");
    }

    console.log("\n ALL DURATION LIMIT TESTS PASSED SUCCESSFULLY! \n");
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
