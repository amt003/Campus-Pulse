/**
 * CampusPulse Database Reset Script
 * 
 * Cleans all transactional and user data from MongoDB while strictly preserving:
 * 1. TPO User account(s) (role === "TPO")
 * 2. College Placement Configuration (CollegeConfig)
 * 3. Standard Curated Questions (Optional/Preserved)
 */

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const User = require("../models/User");
const Student = require("../models/Student");
const Recruiter = require("../models/Recruiter");
const JobDrive = require("../models/JobDrive");
const Application = require("../models/Application");
const Schedule = require("../models/Schedule");
const AptitudeTest = require("../models/AptitudeTest");
const TestAttempt = require("../models/TestAttempt");
const Notification = require("../models/Notification");
const EmailLog = require("../models/EmailLog");
const ResumeParse = require("../models/ResumeParse");
const PastQuestion = require("../models/PastQuestion");
const RecruiterTrustScore = require("../models/RecruiterTrustScore");
const QuestionBank = require("../models/QuestionBank");

const cleanDatabase = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await connectDB();

    console.log("\n=======================================================");
    console.log("  🧹 STARTING DATABASE CLEANUP (PRESERVING TPO DATA)");
    console.log("=======================================================\n");

    // 1. Identify TPO users to preserve
    const tpoUsers = await User.find({ role: { $regex: /^tpo$/i } });
    console.log(`🔒 Found ${tpoUsers.length} TPO account(s) to PRESERVE:`);
    tpoUsers.forEach(u => console.log(`   - ${u.name} (${u.email}) [Role: ${u.role}]`));

    if (tpoUsers.length === 0) {
      console.warn("⚠️ Warning: No TPO user found with role 'TPO'.");
    }

    // 2. Delete non-TPO Users
    const delUsers = await User.deleteMany({ role: { $not: /^tpo$/i } });
    console.log(`✅ Deleted ${delUsers.deletedCount} non-TPO user accounts.`);

    // 3. Delete Student profiles
    const delStudents = await Student.deleteMany({});
    console.log(`✅ Deleted ${delStudents.deletedCount} student profiles.`);

    // 4. Delete Recruiter profiles & trust scores
    const delRecruiters = await Recruiter.deleteMany({});
    const delTrust = await RecruiterTrustScore.deleteMany({});
    console.log(`✅ Deleted ${delRecruiters.deletedCount} recruiter profiles and ${delTrust.deletedCount} trust score records.`);

    // 5. Delete Job Drives & Attachments
    const delDrives = await JobDrive.deleteMany({});
    console.log(`✅ Deleted ${delDrives.deletedCount} job drives.`);

    // 6. Delete Applications
    const delApps = await Application.deleteMany({});
    console.log(`✅ Deleted ${delApps.deletedCount} applications.`);

    // 7. Delete Schedules
    const delSchedules = await Schedule.deleteMany({});
    console.log(`✅ Deleted ${delSchedules.deletedCount} schedules.`);

    // 8. Delete Aptitude Tests & Test Attempts
    const delTests = await AptitudeTest.deleteMany({});
    const delAttempts = await TestAttempt.deleteMany({});
    console.log(`✅ Deleted ${delTests.deletedCount} tests and ${delAttempts.deletedCount} test attempts.`);

    // 9. Delete Notifications & Email Logs
    const delNotifs = await Notification.deleteMany({});
    const delEmails = await EmailLog.deleteMany({});
    console.log(`✅ Deleted ${delNotifs.deletedCount} notifications and ${delEmails.deletedCount} email logs.`);

    // 10. Delete Custom Questions / Question Banks (Keep system-curated if desired)
    const delQb = await QuestionBank.deleteMany({ isCurated: { $ne: true } });
    console.log(`✅ Deleted ${delQb.deletedCount} recruiter custom question banks.`);

    // 11. Delete Resume Parses & Past Questions
    const delResumes = await ResumeParse.deleteMany({});
    const delPastQ = await PastQuestion.deleteMany({});
    console.log(`✅ Deleted ${delResumes.deletedCount} resume parses and ${delPastQ.deletedCount} past questions.`);

    console.log("\n=======================================================");
    console.log("  ✨ DATABASE CLEANUP COMPLETE!");
    console.log("  Ready to test the entire flow from beginning to end.");
    console.log("=======================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Cleanup failed with error:", error);
    process.exit(1);
  }
};

cleanDatabase();
