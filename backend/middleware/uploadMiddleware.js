const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure resumes directory exists
const resumeDir = path.join(__dirname, "..", "uploads", "resumes");
if (!fs.existsSync(resumeDir)) {
  fs.mkdirSync(resumeDir, { recursive: true });
}

// Ensure logos directory exists
const logoDir = path.join(__dirname, "..", "uploads", "logos");
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resumeDir);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["application/pdf"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Only PDF files are allowed"), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/png", "image/jpg", "image/jpeg", "image/gif", "image/webp"];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Only image files (PNG, JPG, JPEG, GIF, WEBP) are allowed"), false);
  }

  cb(null, true);
};

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

// Ensure offers directory exists
const offerDir = path.join(__dirname, "..", "uploads", "offers");
if (!fs.existsSync(offerDir)) {
  fs.mkdirSync(offerDir, { recursive: true });
}

const offerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, offerDir);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const uploadOffer = multer({
  storage: offerStorage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
});

const { isCloudinaryConfigured, uploadToCloudinary } = require("../config/cloudinary");

/**
 * Express middleware that checks if Cloudinary is configured.
 * If configured, it streams the uploaded file to Cloudinary and sets req.file.cloudinaryUrl.
 * If not configured or if an error occurs, it smoothly retains the local file.
 */
const processCloudinaryUpload = (folder = "campuspulse/uploads", resourceType = "auto") => {
  return async (req, res, next) => {
    if (!req.file || !isCloudinaryConfigured()) {
      return next();
    }

    try {
      const result = await uploadToCloudinary(req.file.path, {
        folder,
        resource_type: resourceType,
      });

      if (result && result.secure_url) {
        req.file.cloudinaryUrl = result.secure_url;
      }
      next();
    } catch (err) {
      console.warn(`[Cloudinary Warning] Cloud upload failed: ${err.message}. Retaining local file fallback.`);
      next();
    }
  };
};

module.exports = upload;
module.exports.upload = upload;
module.exports.uploadImage = uploadImage;
module.exports.uploadOffer = uploadOffer;
module.exports.processCloudinaryUpload = processCloudinaryUpload;
