const cron = require("node-cron");
const Schedule = require("../models/Schedule");
const sendEmail = require("./sendEmail");

const initCronScheduler = () => {
  // Run every hour to check for upcoming interviews in the next 24 hours
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("[Cron] Checking for upcoming drive interview reminders...");
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const upcomingSchedules = await Schedule.find({
        status: "Scheduled",
        reminderSent: false,
        date: { $gte: now, $lte: in24Hours },
      })
        .populate({
          path: "studentId",
          populate: { path: "userId", select: "name email" },
        })
        .populate("driveId", "title");

      for (const schedule of upcomingSchedules) {
        if (schedule.studentId && schedule.studentId.userId && schedule.studentId.userId.email) {
          const userEmail = schedule.studentId.userId.email;
          const studentName = schedule.studentId.userId.name;
          const driveTitle = schedule.driveId ? schedule.driveId.title : "Placement Drive";

          await sendEmail({
            to: userEmail,
            subject: `Reminder: Upcoming ${schedule.eventType} for ${driveTitle}`,
            html: `
              <h3>CampusPulse Interview Reminder</h3>
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>This is a reminder for your upcoming <strong>${schedule.eventType}</strong> round.</p>
              <ul>
                <li><strong>Drive:</strong> ${driveTitle}</li>
                <li><strong>Date:</strong> ${new Date(schedule.date).toDateString()}</li>
                <li><strong>Time Slot:</strong> ${schedule.timeSlot}</li>
                <li><strong>Location:</strong> ${schedule.location}</li>
              </ul>
              <p>Good luck!</p>
            `,
          });

          schedule.reminderSent = true;
          await schedule.save();
        }
      }
    } catch (error) {
      console.error("[Cron Error] Failed during reminder execution:", error.message);
    }
  });

  console.log("⏰ Cron reminder scheduler initialized.");
};

module.exports = initCronScheduler;
