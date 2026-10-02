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
  getDriveAttachments,
  uploadDriveAttachment,
  deleteDriveAttachment,
  downloadDriveAttachment,
  getAllRecruiterApplications,
  getAllRecruiterOffers,
  getRecruiterOfferPdf,
  resubmitDriveForApproval,
  getSeasonConfig,
} = require("../controllers/recruiterController");
const {
  addQuestion,
  getQuestions,
  updateQuestion,
  deleteQuestion,
  generateDraftQuestions,
  getDraftQuestions,
  approveDraftQuestion,
  rejectDraftQuestion,
  generateFromBank,
  parseQuestionsFromUploadedPdf,
  bulkAddQuestions,
} = require("../controllers/questionBankController");
const {
  createTest,
  publishTest,
  getTestDetails,
  getTestResults,
  getRecruiterTests,
} = require("../controllers/aptitudeTestController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { uploadImage, uploadOffer } = require("../middleware/uploadMiddleware");
const multer = require("multer");
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const router = express.Router();

router.use(protect, authorizeRoles("Recruiter"));

router.get("/season-config", getSeasonConfig);
router.get("/profile", getRecruiterProfile);
router.get("/analytics", getRecruiterAnalytics);
router.put("/profile", uploadImage.single("logo"), updateRecruiterProfile);
router.post("/request-reapproval", requestReapproval);
router.post("/drive", createJobDrive);
router.post("/drive/:driveId/resubmit", resubmitDriveForApproval);
router.get("/drives", getRecruiterDrives);
router.get("/all-applications", getAllRecruiterApplications);
router.get("/all-offers", getAllRecruiterOffers);
router.get("/offer/:applicationId/pdf", getRecruiterOfferPdf);
router.get("/offer/download/:applicationId", getRecruiterOfferPdf);
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

// Attachments / Preparation Resources
router.get("/drive/:driveId/attachments", getDriveAttachments);
router.post("/drive/:driveId/attachment", memoryUpload.single("file"), uploadDriveAttachment);
router.delete("/drive/:driveId/attachment/:fileId", deleteDriveAttachment);
router.get("/drive/attachment/download/:fileId", downloadDriveAttachment);

// Aptitude Test Routes (Phase 5)
router.post("/test/generate-from-bank", generateFromBank);
router.post("/test", createTest);
router.get("/tests", getRecruiterTests);
router.put("/test/:id/publish", publishTest);
router.get("/test/:id/results", getTestResults);
router.get("/test/:id", getTestDetails);

// Question Bank Routes (Phase 2 & Phase 3 & Phase 4 & PDF Upload)
router.post("/question/generate", generateDraftQuestions);
router.post("/question/parse-pdf", memoryUpload.single("pdf"), parseQuestionsFromUploadedPdf);
router.post("/question/bulk", bulkAddQuestions);
router.get("/question/drafts", getDraftQuestions);
router.put("/question/:id/approve", approveDraftQuestion);
router.put("/question/:id/reject", rejectDraftQuestion);
router.post("/question", addQuestion);
router.get("/questions", getQuestions);
router.put("/question/:id", updateQuestion);
router.delete("/question/:id", deleteQuestion);

module.exports = router;

