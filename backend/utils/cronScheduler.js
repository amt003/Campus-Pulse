const cron = require("node-cron");
const Schedule = require("../models/Schedule");
const JobDrive = require("../models/JobDrive");
const sendEmail = require("./sendEmail");
const emailTemplates = require("./emailTemplates");

const expirePassedDrives = async () => {
  try {
    const now = new Date();
    const result = await JobDrive.updateMany(
      {
        status: "Open",
        applicationDeadline: { $lt: now },
      },
      {
        $set: { status: "Expired" },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Cron] Automatically expired ${result.modifiedCount} drive(s) with past deadlines.`);
    }
  } catch (err) {
    console.error("[Cron Error] Failed to expire past drives:", err.message);
  }
};

const initCronScheduler = () => {
  // 1. Run drive expiration check immediately on startup
  expirePassedDrives();

  // 2. Schedule drive expiration check every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    expirePassedDrives();
  });

  // 3. Run every hour to check for upcoming interviews scheduled for tomorrow
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("[Cron] Running reminder cron job to check for tomorrow's placement round schedules...");

      // Calculate 24 hours from now to define the window for "tomorrow"
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const startOfDay = new Date(tomorrow);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(tomorrow);
      endOfDay.setHours(23, 59, 59, 999);

      // Query schedules for tomorrow that have not had reminders sent yet
      const upcomingSchedules = await Schedule.find({
        status: "Scheduled",
        reminderSent: false,
        date: { $gte: startOfDay, $lte: endOfDay },
      })
        .populate({
          path: "studentId",
          populate: { path: "userId", select: "name email" },
        })
        .populate("driveId", "title")
        .populate("recruiterId", "companyName");

      console.log(`[Cron] Found ${upcomingSchedules.length} schedules for tomorrow.`);

      for (const schedule of upcomingSchedules) {
        if (
          schedule.studentId &&
          schedule.studentId.userId &&
          schedule.studentId.userId.email
        ) {
          const userEmail = schedule.studentId.userId.email;
          const studentName = schedule.studentId.userId.name;
          const driveTitle = schedule.driveId ? schedule.driveId.title : "Placement Drive";
          const companyName = schedule.recruiterId ? schedule.recruiterId.companyName : "Campus Recruiter";

          await sendEmail({
            to: userEmail,
            ...emailTemplates.reminder({
              studentName,
              companyName,
              roundType: schedule.eventType,
              driveTitle,
              date: schedule.date,
              time: schedule.timeSlot,
              location: schedule.location || "Online",
            }),
          });

          schedule.reminderSent = true;
          await schedule.save();
          console.log(`[Cron] Reminder sent to ${userEmail} for ${companyName} (${schedule.eventType})`);
        }
      }
    } catch (error) {
      console.error("[Cron Error] Failed during reminder execution:", error.message);
    }
  });

  console.log("⏰ Cron reminder scheduler initialized.");
};

module.exports = initCronScheduler;
