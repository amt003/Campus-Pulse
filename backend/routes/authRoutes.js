const express = require("express");
const {
  registerUser,
  loginUser,
  getCurrentUser,
  googleLogin,
  getGoogleClientId,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.get("/google/client-id", getGoogleClientId);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getCurrentUser);

module.exports = router;
