const express = require("express");
const {
  registerUser,
  loginUser,
  getCurrentUser,
  googleLogin,
  getGoogleClientId,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.get("/google/client-id", getGoogleClientId);
router.get("/me", protect, getCurrentUser);

module.exports = router;
