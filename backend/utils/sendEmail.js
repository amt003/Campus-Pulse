const nodemailer = require("nodemailer");
require("dotenv").config();

// Validate environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error(" EMAIL_USER or EMAIL_PASS is not defined in .env file");
}

let transporter;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail", // For Gmail. If using another provider, update this.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Verify connection on startup
  transporter.verify((error, success) => {
    if (error) {
      console.error(" Nodemailer connection error:", error);
    } else {
      console.log("✅ Nodemailer is ready to send emails.");
    }
  });
}

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!transporter) {
      console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
      return { success: true, mocked: true };
    }

    const info = await transporter.sendMail({
      from: `"CampusPulse Admin" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || "",
      html: html || text,
    });

    console.log("Email sent: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;
