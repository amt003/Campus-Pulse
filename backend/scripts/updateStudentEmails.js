const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");
const Student = require("../models/Student");

const branchMap = {
  cse: "cs",
  cs: "cs",
  it: "it",
  ece: "ec",
  ec: "ec",
  ee: "ee",
  eee: "ee",
  me: "me",
  mechanical: "me",
  ce: "ce",
  ad: "ad",
  mca: "mca",
  bca: "bca",
};

function getBranchCode(branch) {
  if (!branch) return "gen";
  const bLower = branch.toLowerCase().trim();
  return branchMap[bLower] || bLower;
}

async function updateStudentEmails() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB!");

    const students = await Student.find();
    console.log(`Found ${students.length} student records in database.`);

    const usedEmails = new Set();
    // First preserve any non-student emails that might exist in User collection
    const nonStudentUsers = await User.find({ role: { $ne: "Student" } });
    for (const u of nonStudentUsers) {
      usedEmails.add(u.email.toLowerCase());
    }

    let updatedCount = 0;

    for (const s of students) {
      const user = await User.findById(s.userId);
      if (!user) continue;

      // Extract first name
      const rawName = user.name || "student";
      let firstName = rawName.trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!firstName || firstName === "student") {
        // If name is like "Student CS24B001", extract branch/roll or fallback to student
        if (rawName.toLowerCase().startsWith("student ")) {
          firstName = "student";
        }
      }

      const branchCode = getBranchCode(s.branch);
      const year = s.passoutYear || 2027;

      let targetEmail = `${firstName}${branchCode}${year}@alphabetcollege.edu.in`;

      // If email collision occurs, append roll index to ensure uniqueness
      if (usedEmails.has(targetEmail.toLowerCase())) {
        const rollSuffix = s.rollNumber ? s.rollNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : Math.floor(Math.random() * 1000);
        targetEmail = `${firstName}${branchCode}${rollSuffix}${year}@alphabetcollege.edu.in`;
      }

      usedEmails.add(targetEmail.toLowerCase());

      if (user.email !== targetEmail) {
        console.log(`Updating ${user.email} -> ${targetEmail}`);
        user.email = targetEmail;
        await user.save();
        updatedCount++;
      }
    }

    console.log("==========================================");
    console.log(`✅ Updated ${updatedCount} student email(s) in the database!`);
    console.log("==========================================");

    process.exit(0);
  } catch (err) {
    console.error("Error updating student emails in DB:", err);
    process.exit(1);
  }
}

updateStudentEmails();
