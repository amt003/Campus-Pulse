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
} = require("../controllers/studentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("Student"));

router.post("/profile", createStudentProfile);
router.get("/profile", getStudentProfile);
router.put("/profile", updateStudentProfile);
router.post("/resume", upload.single("resume"), uploadResume);
router.get("/drives", getEligibleDrives);
router.post("/apply/:driveId", applyToDrive);
router.get("/applications", getStudentApplications);
router.get("/application/:id", getApplicationById);

module.exports = router;
