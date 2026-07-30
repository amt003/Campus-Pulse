const express = require("express");
const {
  getRecruiterProfile,
  getDriveApplications,
  updateApplicationStatus,
  createJobDrive,
  getRecruiterDrives,
  getJobDriveById,
  updateJobDrive,
  closeJobDrive,
  markAptitudeResult,
  markGDResult,
  markInterviewResult,
  scheduleStage,
} = require("../controllers/recruiterController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("Recruiter"));

router.get("/profile", getRecruiterProfile);
router.post("/drive", createJobDrive);
router.get("/drives", getRecruiterDrives);
router.get("/drive/:id", getJobDriveById);
router.put("/drive/:id", updateJobDrive);
router.put("/drive/:id/close", closeJobDrive);
router.get("/applications/:driveId", getDriveApplications);
router.put("/application/:applicationId/status", updateApplicationStatus);
router.put("/result/aptitude", markAptitudeResult);
router.put("/result/gd", markGDResult);
router.put("/result/interview", markInterviewResult);
router.post("/schedule/:driveId", scheduleStage);

module.exports = router;
