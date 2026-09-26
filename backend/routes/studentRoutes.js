const express = require("express");
const {
  createStudentProfile,
  getStudentProfile,
  updateStudentProfile,
  uploadResume,
  getEligibleDrives,
  applyToDrive,
  getStudentApplications,
  getApplicationById,
  getStudentSchedule,
  acceptOffer,
  declineOffer,
  getOfferDetails,
  getOfferPdf,
  getPreparationResources,
  getSeasonConfig,
  getMyReadiness,
} = require("../controllers/studentController");
const {
  getUpcomingTests,
  startTest,
  saveAnswers,
  submitTest,
  getMyResult,
  logViolation,
} = require("../controllers/testAttemptController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { downloadDriveAttachment } = require("../controllers/recruiterController");

const router = express.Router();

router.use(protect, authorizeRoles("Student"));
router.get("/season-config", getSeasonConfig);
router.get("/drive/attachment/download/:fileId", downloadDriveAttachment);

// Placement Readiness Analyzer (PRA) Route
router.get("/my-readiness", getMyReadiness);

router.post("/profile", createStudentProfile);
router.get("/profile", getStudentProfile);
router.put("/profile", upload.uploadImage.single("profilePic"), updateStudentProfile);
router.post("/resume", upload.single("resume"), uploadResume);
router.get("/drives", getEligibleDrives);
router.post("/apply/:driveId", applyToDrive);
router.get("/applications", getStudentApplications);
router.get("/application/:id", getApplicationById);
router.get("/schedule", getStudentSchedule);

// Offer Routes
router.get("/offer/:applicationId", getOfferDetails);
router.get("/offer/:applicationId/pdf", getOfferPdf);
router.put("/offer/:applicationId/accept", acceptOffer);
router.put("/offer/:applicationId/decline", declineOffer);

// Preparation Resources Route
router.get("/resources/:driveId", getPreparationResources);

// Aptitude Test Delivery Routes (Phase 6)
router.get("/test/upcoming", getUpcomingTests);
router.get("/test/:id/start", startTest);
router.post("/test/attempt/:attemptId/save", saveAnswers);
router.post("/test/attempt/:attemptId/submit", submitTest);
router.get("/test/attempt/:attemptId/result", getMyResult);
router.post("/test/attempt/:attemptId/violation", logViolation);

module.exports = router;
