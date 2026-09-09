const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const recruiterRoutes = require("./routes/recruiterRoutes");
const tpoRoutes = require("./routes/tpoRoutes");
const initCronScheduler = require("./utils/cronScheduler");

const http = require("http");
const socketService = require("./services/socketService");
const notificationRoutes = require("./routes/notificationRoutes");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
socketService.init(server);

const fs = require("fs");
const { ensureSampleResumesExist } = require("./utils/initSampleResumes");

// Ensure default and sample resume PDFs exist on disk
ensureSampleResumesExist();

// --- Middleware ---
app.use(cors()); // Allow Angular frontend to call this API
app.use(express.json({ limit: '50mb' })); // Parse incoming JSON requests with increased limit
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Dedicated Resume route with fallback to ensure PDFs load cleanly
app.get("/uploads/resumes/:filename", (req, res) => {
  const requestedFile = req.params.filename;
  const filePath = path.join(__dirname, "uploads", "resumes", requestedFile);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // Fallback to sample resume if specific file is missing on disk
  const defaultResumePath = path.join(__dirname, "uploads", "resumes", "default_resume.pdf");
  if (fs.existsSync(defaultResumePath)) {
    return res.sendFile(defaultResumePath);
  }

  return res.status(404).send("Resume file not found");
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const { initializeCollegeConfig } = require("./utils/initCollegeConfig");

// --- Connect to Database ---
connectDB().then(() => {
  initializeCollegeConfig();
});

// --- Initialize Background Cron Jobs ---
initCronScheduler();

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/recruiter", recruiterRoutes);
app.use("/api/tpo", tpoRoutes);
app.use("/api/notifications", notificationRoutes);

// --- Test Route (To verify everything works) ---
app.get("/api/test", (req, res) => {
  res.json({ message: "CampusPulse Backend is Running!" });
});

// --- Basic User Route (Temporary) ---
app.get("/api", (req, res) => {
  res.send("CampusPulse API is live");
});

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
