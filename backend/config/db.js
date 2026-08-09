const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(` MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(` MongoDB Atlas Connection failed: ${error.message}. Attempting local fallback...`);
    try {
      const connLocal = await mongoose.connect("mongodb://127.0.0.1:27017/CampusPulse");
      console.log(` MongoDB Local Connected: ${connLocal.connection.host}`);
    } catch (localError) {
      console.error(` MongoDB Local Connection failed: ${localError.message}`);
      console.error(` MongoDB Connection Error: Both remote Atlas and local instances failed.`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
