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
  reverifyRecruiter
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

// Analytics routes
router.get('/analytics', getDashboardAnalytics);
router.get('/funnel', getPlacementFunnel);
router.get('/branch-stats', getBranchWiseStats);
router.get('/offer-trends', getOfferAcceptanceTrends);

// Students management routes
router.get('/students', getStudentsList);

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
