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

// --- Middleware ---
app.use(cors()); // Allow Angular frontend to call this API
app.use(express.json({ limit: '50mb' })); // Parse incoming JSON requests with increased limit
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Connect to Database ---
connectDB();

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
