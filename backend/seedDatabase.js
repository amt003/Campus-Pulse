const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Student = require("./models/Student");
const Recruiter = require("./models/Recruiter");
const JobDrive = require("./models/JobDrive");
const Application = require("./models/Application");

async function seedDatabase() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB!");

    console.log("Clearing existing data for a fresh real seed...");
    await Promise.all([
      User.deleteMany({ email: { $ne: "tpo@alphabet.edu" } }),
      Student.deleteMany({}),
      Recruiter.deleteMany({}),
      JobDrive.deleteMany({}),
      Application.deleteMany({}),
    ]);

    // 1. Create Recruiter Users & Recruiter Documents
    console.log("Creating Recruiters...");
    const recruiterData = [
      { companyName: "Google India", officialEmail: "hr@google.com", website: "https://google.com", gstNumber: "22AAAAA0000A1Z5", isApproved: true, trustScore: 98 },
      { companyName: "Microsoft", officialEmail: "careers@microsoft.com", website: "https://microsoft.com", gstNumber: "22BBBBB0000A1Z5", isApproved: true, trustScore: 95 },
      { companyName: "Amazon", officialEmail: "recruiting@amazon.com", website: "https://amazon.jobs", gstNumber: "22CCCCC0000A1Z5", isApproved: true, trustScore: 92 },
      { companyName: "Tata Consultancy Services", officialEmail: "hr@tcs.com", website: "https://tcs.com", gstNumber: "22DDDDD0000A1Z5", isApproved: true, trustScore: 88 },
      { companyName: "FinTech Global", officialEmail: "careers@fintech.io", website: "https://fintech.io", gstNumber: "22EEEEE0000A1Z5", isApproved: false, trustScore: 78 },
      { companyName: "NextGen Software", officialEmail: "hr@nextgen.com", website: "https://nextgen.com", gstNumber: "22FFFFF0000A1Z5", isApproved: false, trustScore: 65 },
      { companyName: "Innovate Labs", officialEmail: "contact@innovatelabs.io", website: "https://innovatelabs.io", gstNumber: "22GGGGG0000A1Z5", isApproved: false, trustScore: 55 },
    ];

    const recruiters = [];
    for (const r of recruiterData) {
      const u = await User.create({
        name: r.companyName + " HR",
        email: r.officialEmail,
        password: "Password123!",
        role: "Recruiter",
        phone: "+91 9876543210",
      });

      const rec = await Recruiter.create({
        userId: u._id,
        companyName: r.companyName,
        gstNumber: r.gstNumber,
        website: r.website,
        officialEmail: r.officialEmail,
        isApproved: r.isApproved,
        trustScore: r.trustScore,
        verifiedAt: r.isApproved ? new Date() : null,
      });

      recruiters.push(rec);
    }

    // 2. Create Active Job Drives
    console.log("Creating Job Drives...");
    const approvedRecruiters = recruiters.filter((r) => r.isApproved);
    const driveTitles = [
      "Software Development Engineer (SDE-1)",
      "Systems Engineer",
      "Cloud & Data Analyst",
      "DevOps Specialist",
      "Full Stack Developer",
    ];

    const drives = [];
    for (let i = 0; i < 12; i++) {
      const rec = approvedRecruiters[i % approvedRecruiters.length];
      const drive = await JobDrive.create({
        recruiterId: rec.userId,
        title: `${driveTitles[i % driveTitles.length]} - Drive ${i + 1}`,
        description: "Join our core engineering team to build scalable systems.",
        ctc: 1200000 + (i * 200000),
        minCGPA: 7.0,
        eligibleBranches: ["CSE", "IT", "ECE", "Mechanical"],
        maxBacklogs: 1,
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        hasAptitudeTest: true,
        hasGD: true,
        status: "Open",
      });
      drives.push(drive);
    }

    // 3. Create 500 Students across CSE, IT, ECE, Mechanical
    console.log("Creating 500 Students across CSE, IT, ECE, Mechanical...");
    const branches = [
      { name: "CSE", count: 125, placementRate: 0.80 },
      { name: "IT", count: 125, placementRate: 0.75 },
      { name: "ECE", count: 125, placementRate: 0.70 },
      { name: "Mechanical", count: 125, placementRate: 0.60 },
    ];

    const students = [];
    let rollCounter = 1;

    for (const b of branches) {
      const countToPlace = Math.round(b.count * b.placementRate);

      for (let i = 0; i < b.count; i++) {
        const isPlacedStudent = i < countToPlace;
        const rollNumber = `${b.name}24B${String(rollCounter++).padStart(3, "0")}`;
        const email = `student.${rollNumber.toLowerCase()}@alphabet.edu`;

        const user = await User.create({
          name: `Student ${rollNumber}`,
          email,
          password: "StudentPassword123!",
          role: "Student",
          phone: "+91 9876543210",
        });

        const student = await Student.create({
          userId: user._id,
          rollNumber,
          cgpa: Number((7.0 + Math.random() * 2.8).toFixed(2)),
          branch: b.name,
          passoutYear: 2024,
          activeBacklogs: Math.random() > 0.85 ? 1 : 0,
          isProfileComplete: true,
        });

        students.push({ student, isPlacedStudent, branch: b.name });
      }
    }

    // 4. Create Applications for Placement Funnel (500 Applied, 350 Aptitude, 250 GD, 180 Interviewed, 320 Placed, 30 Declined)
    console.log("Generating Applications & Placement Funnel Data...");
    const primaryDrive = drives[0];

    // Target counts for placement funnel
    // Applied: 500, Aptitude: 350, GD: 250, Interviewed: 180, Placed: 320 (320 accepted + 30 declined = 350 offer total)
    let aptitudeCounter = 0;
    let gdCounter = 0;
    let interviewCounter = 0;
    let placedCounter = 0;
    let declinedCounter = 0;

    for (let idx = 0; idx < students.length; idx++) {
      const s = students[idx];
      const isPlaced = s.isPlacedStudent;

      let status = "Applied";
      let aptitudeStatus = "Not Applicable";
      let gdStatus = "Not Applicable";
      let interviewStatus = "Pending";
      let offerStatus = "Not Sent";

      if (isPlaced) {
        // Placed student flow
        status = "Placed";
        aptitudeStatus = "Passed";
        gdStatus = "Shortlisted";
        interviewStatus = "Completed";

        if (declinedCounter < 30 && idx % 10 === 0) {
          offerStatus = "Declined";
          declinedCounter++;
        } else {
          offerStatus = "Accepted";
          placedCounter++;
        }
        aptitudeCounter++;
        gdCounter++;
        interviewCounter++;
      } else {
        // Unplaced student breakdown across earlier stages
        if (aptitudeCounter < 350 && idx % 3 === 0) {
          aptitudeStatus = "Passed";
          aptitudeCounter++;
          if (gdCounter < 250 && idx % 4 === 0) {
            gdStatus = "Shortlisted";
            gdCounter++;
            if (interviewCounter < 180) {
              interviewStatus = "Completed";
              interviewCounter++;
              status = "Interview Completed";
            } else {
              status = "GD Completed";
            }
          } else {
            status = "Aptitude Completed";
          }
        } else {
          status = "Applied";
        }
      }

      await Application.create({
        studentId: s.student._id,
        driveId: primaryDrive._id,
        appliedDate: new Date(),
        status,
        aiMatchScore: Number((0.65 + Math.random() * 0.3).toFixed(2)),
        aptitude: {
          status: aptitudeStatus,
          score: aptitudeStatus === "Passed" ? 85 : 45,
          markedAt: new Date(),
        },
        gd: {
          status: gdStatus,
          markedAt: new Date(),
        },
        interview: {
          status: interviewStatus,
          result: isPlaced ? "Selected" : "Pending",
          feedback: isPlaced ? "Excellent technical candidate" : "Good communication",
          markedAt: new Date(),
        },
        offer: {
          status: offerStatus,
          uploadedDate: offerStatus !== "Not Sent" ? new Date() : null,
          acceptedAt: offerStatus === "Accepted" ? new Date() : null,
          declinedAt: offerStatus === "Declined" ? new Date() : null,
          declineReason: offerStatus === "Declined" ? "Opted for higher studies" : null,
        },
      });
    }

    console.log("==========================================");
    console.log("✅ Database Seeding Completed Successfully!");
    console.log(`- 500 Students (CSE, IT, ECE, Mechanical)`);
    console.log(`- 12 Active Job Drives`);
    console.log(`- 500 Drive Applications matching Placement Funnel`);
    console.log(`- 3 Pending Recruiters awaiting TPO Approval`);
    console.log("==========================================");

    process.exit();
  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
}

seedDatabase();
