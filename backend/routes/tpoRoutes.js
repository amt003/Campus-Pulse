const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getStudentsList,
  getPendingRecruiters,
  getApprovedRecruiters,
  getOnHoldRecruiters,
  getRecruiterVerificationDetails,
  approveRecruiter,
  rejectRecruiter,
  putRecruiterOnHold,
  getDashboardAnalytics,
  getPlacementFunnel,
  getBranchWiseStats,
  getOfferAcceptanceTrends,
  bulkImportStudents,
  addRecruiterSuggestion,
  toggleRecruiterStatus,
  reVerifyRecruiter,
  reverifyRecruiter,
  getPendingDrives,
  approveDrive,
  rejectDrive,
  holdDrive,
  getSeasonConfig,
  updateSeasonConfig,
  getStudentAuditDetails,
  getCollegeConfig,
  updateCollegeConfig,
  addBranch,
  deleteBranch,
  addPassoutYear,
  deletePassoutYear,
  getAllDrivesForTPO,
  getDriveApplicationsForTPO,
  getAllSchedules,
  getCalendarSummary,
  getStudentReadiness,
  getDepartmentReadiness,
  getAllStudentsReadiness,
} = require('../controllers/tpoController');

// All routes require authentication and TPO role
router.use(protect);
router.use((req, res, next) => {
  const userRole = req.user.role ? req.user.role.toLowerCase() : '';
  if (userRole !== 'tpo') {
    return res.status(403).json({ success: false, message: 'Access denied. TPO only.' });
  }
  next();
});

// Master Calendar & Schedule routes
router.get('/schedules', getAllSchedules);
router.get('/schedules/summary', getCalendarSummary);

// College configuration & Season routes
router.get('/college-config', getCollegeConfig);
router.put('/college-config', updateCollegeConfig);
router.post('/college-config/branch', addBranch);
router.delete('/college-config/branch/:branch', deleteBranch);
router.post('/college-config/passout-year', addPassoutYear);
router.delete('/college-config/passout-year/:year', deletePassoutYear);

router.get('/season-config', getSeasonConfig);
router.put('/season-config', updateSeasonConfig);

// Analytics routes
router.get('/analytics', getDashboardAnalytics);
router.get('/funnel', getPlacementFunnel);
router.get('/branch-stats', getBranchWiseStats);
router.get('/offer-trends', getOfferAcceptanceTrends);

// Students management routes
router.get('/students', getStudentsList);
router.get('/student/:rollNumber/audit', getStudentAuditDetails);

// Placement Readiness Analyzer (PRA) routes
router.get('/analyzer/student/:rollNumber', getStudentReadiness);
router.get('/analyzer/department/:branch', getDepartmentReadiness);
router.get('/analyzer/overview', getAllStudentsReadiness);

// Drive & Oversee Drives routes
router.get('/drives', getAllDrivesForTPO);
router.get('/drive/:driveId/applications', getDriveApplicationsForTPO);
router.get('/drives/pending', getPendingDrives);
router.put('/drive/:id/approve', approveDrive);
router.put('/drive/:id/reject', rejectDrive);
router.put('/drive/:id/hold', holdDrive);

// Recruiter management routes
router.get('/recruiters/pending', getPendingRecruiters);
router.get('/recruiters/on-hold', getOnHoldRecruiters);
router.get('/recruiters/approved', getApprovedRecruiters);
router.get('/recruiter/:id/verify', getRecruiterVerificationDetails);
router.put('/recruiter/:id/approve', approveRecruiter);
router.put('/recruiter/:id/hold', putRecruiterOnHold);
router.put('/recruiter/:id/reject', rejectRecruiter);
router.put('/recruiter/:id/toggle-status', toggleRecruiterStatus);
router.post('/recruiter/:id/suggestion', addRecruiterSuggestion);
router.put('/recruiter/:id/re-verify', reVerifyRecruiter);
router.put('/recruiter/:id/reverify', reverifyRecruiter);


// Import routes
router.post('/import-students', bulkImportStudents);

module.exports = router;
