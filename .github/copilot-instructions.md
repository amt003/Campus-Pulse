Full Project Context Prompt (Copy and Paste into VS Code)
markdown

# Project: CampusPulse - AI-Driven Campus Placement Automation System

## 1. Project Overview

CampusPulse is a full-stack, AI-enhanced placement automation system for a single college (Semester 1). It automates the entire campus recruitment lifecycle—from job drive creation to final offer acceptance—for three user roles: Students, Recruiters, and TPOs (Training & Placement Officers).

## 2. Tech Stack

### Backend:

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM) hosted on MongoDB Atlas
- **Authentication:** JSON Web Tokens (JWT) + bcryptjs
- **Email:** Nodemailer + node-cron
- **Real-time:** Socket.IO (for live notifications)
- **AI Service:** Python Flask microservice (Sentence-BERT for resume ranking)

### Frontend:

- **Framework:** Angular 17+
- **Styling:** CSS / Tailwind CSS (as per Figma designs)

## 3. Folder Structure

campuspulse/
├── backend/
│ ├── config/
│ │ └── db.js # MongoDB connection
│ ├── models/ # Mongoose schemas
│ │ ├── User.js
│ │ ├── Student.js
│ │ ├── Recruiter.js
│ │ ├── JobDrive.js
│ │ ├── Application.js
│ │ ├── Schedule.js
│ │ └── RecruiterTrustScore.js
│ ├── routes/ # Express routes
│ │ ├── authRoutes.js
│ │ ├── studentRoutes.js
│ │ ├── recruiterRoutes.js
│ │ └── tpoRoutes.js
│ ├── controllers/ # Business logic
│ ├── middleware/ # Auth, validation
│ ├── utils/ # Helpers
│ ├── .env # Environment variables
│ ├── package.json
│ └── server.js # Entry point
├── frontend/ # Angular application
│ ├── src/
│ │ ├── app/
│ │ │ ├── components/
│ │ │ ├── services/
│ │ │ ├── models/
│ │ │ └── app.module.ts
│ │ └── index.html
│ └── package.json
├── ai-service/ # Python microservice (Future)
│ └── app.py
└── .gitignore

text

## 4. Database Schema (Semester 1)

### Collections:

**Users**

````javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  role: ['Student', 'Recruiter', 'TPO'],
  phone: String,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
Students

javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: Users),
  rollNumber: String (unique),
  cgpa: Number,
  branch: String,
  passoutYear: Number,
  activeBacklogs: Number,
  resumePath: String (GridFS file ID),
  isProfileComplete: Boolean
}
Recruiters

javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: Users),
  companyName: String,
  gstNumber: String,
  website: String,
  officialEmail: String (unique),
  isApproved: Boolean,
  trustScore: Number,
  verifiedAt: Date
}
JobDrives

javascript
{
  _id: ObjectId,
  recruiterId: ObjectId (ref: Recruiters),
  title: String,
  description: String,
  ctc: Number,
  minCGPA: Number,
  eligibleBranches: [String],
  maxBacklogs: Number,
  applicationDeadline: Date,
  hasAptitudeTest: Boolean,
  hasGD: Boolean,
  status: ['Draft', 'Open', 'Closed'],
  createdAt: Date,
  updatedAt: Date
}
Applications (Embedded sub-documents)

javascript
{
  _id: ObjectId,
  studentId: ObjectId (ref: Students),
  driveId: ObjectId (ref: JobDrives),
  appliedDate: Date,
  status: String, // Applied, Under Review, Aptitude Scheduled, Aptitude Completed, GD Scheduled, GD Completed, Interview Scheduled, Interview Completed, Selected, Rejected, Waitlisted, Offer Sent, Offer Accepted, Offer Declined, Placed
  aiMatchScore: Number,
  aptitude: {
    status: String, // Scheduled, Completed, Passed, Failed, Not Applicable
    score: Number,
    scheduledDate: Date,
    testLink: String,
    markedBy: ObjectId,
    markedAt: Date
  },
  gd: {
    status: String, // Scheduled, Completed, Shortlisted, Rejected, Not Applicable
    scheduledDate: Date,
    markedBy: ObjectId,
    markedAt: Date
  },
  interview: {
    status: String, // Scheduled, Completed, Pending
    result: String, // Selected, Rejected, Waitlisted, Pending
    scheduledDate: Date,
    timeSlot: String,
    feedback: String,
    markedBy: ObjectId,
    markedAt: Date
  },
  xai: {
    matchScore: Number,
    positiveSentences: [String],
    negativeSentences: [String],
    skillGaps: [String]
  },
  offer: {
    status: String, // Sent, Viewed, Downloaded, Accepted, Declined, Expired
    fileId: ObjectId, // GridFS file ID
    fileName: String,
    uploadedDate: Date,
    expiryDate: Date,
    viewedAt: Date,
    acceptedAt: Date,
    declinedAt: Date,
    declineReason: String
  }
}
Schedules

javascript
{
  _id: ObjectId,
  studentId: ObjectId (ref: Students),
  driveId: ObjectId (ref: JobDrives),
  applicationId: ObjectId (ref: Applications),
  eventType: ['Aptitude', 'GD', 'Interview'],
  date: Date,
  timeSlot: String,
  location: String,
  status: ['Scheduled', 'Completed', 'Cancelled'],
  reminderSent: Boolean,
  createdAt: Date
}
// Compound Index: { studentId: 1, date: 1, timeSlot: 1 } for conflict detection
RecruiterTrustScore

javascript
{
  _id: ObjectId,
  recruiterId: ObjectId (ref: Recruiters, unique),
  domain: String,
  whoisData: Object,
  trustScore: Number,
  verifiedAt: Date
}
5. Git Branches
Branch	Purpose
develop	Daily development (Semester 1)
sem1/mini-project	Stable, submission-ready code
6. Environment Variables (.env)
text
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/campuspulse
JWT_SECRET=your_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
7. API Endpoints Design
Auth Routes: /api/auth
Method	Endpoint	Description
POST	/register	Register new user
POST	/login	Login user
Student Routes: /api/student
Method	Endpoint	Description
GET	/profile	Get student profile
PUT	/profile	Update profile
POST	/resume	Upload resume
GET	/drives	Get eligible drives
POST	/apply/:driveId	Apply to drive
GET	/applications	Get all applications
GET	/application/:id	Get application status
Recruiter Routes: /api/recruiter
Method	Endpoint	Description
POST	/drive	Create job drive
GET	/drives	Get all drives
GET	/applications/:driveId	Get applications
POST	/schedule/:driveId	Schedule Aptitude/GD/Interview
PUT	/result/aptitude	Mark Aptitude result
PUT	/result/gd	Mark GD result
PUT	/result/interview	Mark Interview result
TPO Routes: /api/tpo
Method	Endpoint	Description
POST	/import-students	Bulk CSV import
GET	/recruiters/pending	Get pending recruiters
PUT	/recruiter/:id/approve	Approve recruiter
GET	/analytics	Get dashboard stats
8. Middleware
authMiddleware.js: Verify JWT token, attach user to request

roleMiddleware.js: Check user role (Student, Recruiter, TPO)

uploadMiddleware.js: Handle PDF uploads (Multer)

9. Coding Standards
Use ES6+ syntax (async/await, arrow functions)

Use try-catch blocks with proper error responses

All API responses should be in JSON format

Use PascalCase for model names (User, JobDrive)

Use camelCase for variables and functions

Environment variables must be validated before use

10. Dependencies
Backend
json
{
  "express": "^4.18.2",
  "mongoose": "^7.0.0",
  "cors": "^2.8.5",
  "dotenv": "^16.0.3",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.0",
  "nodemailer": "^6.9.0",
  "node-cron": "^3.0.0",
  "multer": "^1.4.5",
  "socket.io": "^4.5.0",
  "express-validator": "^7.0.0"
}
11. Constraints
Semester 1: Single college, single database, monolithic backend

All code must be FOSS (Free & Open Source Software)

Deployment: Localhost only (Semester 1)

MongoDB Atlas free tier (512MB storage)

12. Current Phase
We are implementing the backend with the following priority:

✅ Environment setup

✅ MongoDB Atlas connection

☐ User Model (Authentication)

☐ Student Profile & Resume Upload

☐ Job Drive CRUD

☐ Application Flow

☐ Conflict Detection

☐ AI Resume Ranking (Python microservice)

☐ TPO Dashboard Analytics

☐ Frontend Integration

13. Development Notes
Use error handling middleware

Log errors appropriately

Validate all inputs

Use Mongoose pre-save hooks for password hashing

Use select: false for password field in queries

Implement proper indexing for performance

text

---

## How to Use This Prompt in VS Code

| Method | Steps |
| :--- | :--- |
| **GitHub Copilot** | Open Copilot Chat → Paste the prompt → Say "Use this as context for all code generation" |
| **Cursor AI** | Create a `.cursorrules` file in your project root → Paste the prompt → Cursor will use it as context |
| **Continue.dev** | Add this as a system prompt in your `config.json` |
| **VS Code Chat** | Open Copilot Chat or Gemini in VS Code → Paste the prompt → Ask questions |

---

## Quick Start Commands

```powershell
# Backend
cd backend
npm install
npm run dev

# Frontend (in a new terminal)
cd Frontend
npm install
npm start

# Test backend
curl http://localhost:5000/api/test
````
