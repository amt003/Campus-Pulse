const cloudinary = require("cloudinary").v2;

const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Uploads a file (buffer or file path) to Cloudinary
 * @param {string|Buffer} fileSource - Local file path or Buffer
 * @param {Object} options - { folder: string, resource_type: 'image'|'raw'|'auto' }
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadToCloudinary = (fileSource, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error("Cloudinary credentials are not configured in environment variables."));
    }

    const uploadOptions = {
      folder: options.folder || "campuspulse/uploads",
      resource_type: options.resource_type || "auto",
      ...options,
    };

    if (Buffer.isBuffer(fileSource)) {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      stream.end(fileSource);
    } else {
      cloudinary.uploader.upload(fileSource, uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    }
  });
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
};
