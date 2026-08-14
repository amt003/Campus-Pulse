const Application = require("../models/Application");
const Recruiter = require("../models/Recruiter");

/**
 * Retrieves the placement status and company name for a student if they have been placed
 * or accepted an offer in ANY drive (or optionally in a drive other than currentDriveId).
 *
 * @param {string} studentId
 * @param {string|null} currentDriveId
 * @returns {Promise<{isPlaced: boolean, companyName: string|null, driveTitle: string|null}>}
 */
const getStudentPlacementStatus = async (studentId, currentDriveId = null) => {
  if (!studentId) {
    return { isPlaced: false, companyName: null, driveTitle: null };
  }

  const query = {
    studentId: studentId,
    $or: [
      { status: { $in: ["Placed", "Offer Accepted"] } },
      { "offer.status": "Accepted" }
    ]
  };

  if (currentDriveId) {
    query.driveId = { $ne: currentDriveId };
  }

  const placedApp = await Application.findOne(query).populate("driveId");

  if (placedApp && placedApp.driveId) {
    const recruiter = await Recruiter.findOne({ userId: placedApp.driveId.recruiterId });
    const companyName = recruiter ? recruiter.companyName : "another company";
    const driveTitle = placedApp.driveId.title || "Placement Drive";

    return {
      isPlaced: true,
      companyName,
      driveTitle
    };
  }

  return { isPlaced: false, companyName: null, driveTitle: null };
};

/**
 * Backward compatible helper returning boolean
 */
const isStudentPlaced = async (studentId, currentDriveId = null) => {
  const status = await getStudentPlacementStatus(studentId, currentDriveId);
  return status.isPlaced;
};

module.exports = {
  getStudentPlacementStatus,
  isStudentPlaced
};
