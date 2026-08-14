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
  scheduleEvent,
  getAvailableStudentsForSlot,
  updateRecruiterProfile,
  requestReapproval,
  getResumeText,
  declareAptitudeResults,
  declareGDResults,
  declareInterviewResults,
  uploadOfferLetter,
  getOfferTemplateData,
  bulkUploadAptitudeScores,
  getRecruiterAnalytics,
} = require("../controllers/recruiterController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { uploadImage, uploadOffer } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("Recruiter"));

router.get("/profile", getRecruiterProfile);
router.get("/analytics", getRecruiterAnalytics);
router.put("/profile", uploadImage.single("logo"), updateRecruiterProfile);
router.post("/request-reapproval", requestReapproval);
router.post("/drive", createJobDrive);
router.get("/drives", getRecruiterDrives);
router.get("/drive/:id", getJobDriveById);
router.put("/drive/:id", updateJobDrive);
router.put("/drive/:id/close", closeJobDrive);
router.get("/applications/:driveId", getDriveApplications);
router.get("/drives/:driveId/applications", getDriveApplications);
router.post("/drive/:driveId/bulk-aptitude", bulkUploadAptitudeScores);
router.put("/application/:applicationId/status", updateApplicationStatus);
router.get("/application/:applicationId/resume-text", getResumeText);
router.get("/application/:applicationId/offer-template", getOfferTemplateData);
router.post("/application/:applicationId/offer", uploadOffer.single("offerLetter"), uploadOfferLetter);
router.put("/result/aptitude", declareAptitudeResults);
router.put("/result/gd", declareGDResults);
router.put("/result/interview", declareInterviewResults);
router.post("/schedule/:driveId", scheduleStage);
router.post("/schedule", scheduleEvent);
router.post("/check-availability", getAvailableStudentsForSlot);

module.exports = router;

