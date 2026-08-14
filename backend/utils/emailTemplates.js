const baseTemplate = (content) => `
<div style="max-width:600px; margin:0 auto; font-family:Arial, sans-serif; padding:20px; border:1px solid #eee; border-radius: 8px;">
  <h2 style="color:#1A5276; text-align: center;">CampusPulse</h2>
  <hr style="border-color:#1A5276; border-width: 2px;">
  <div style="padding: 20px 0;">
    ${content}
  </div>
  <hr style="border-color:#eee; margin-top:30px;">
  <p style="font-size:12px; color:#999; text-align: center;">This is an automated message from CampusPulse. Please do not reply.</p>
</div>
`;

const emailTemplates = {
  registrationPending: ({ name, companyName }) => ({
    subject: "Registration Pending – CampusPulse",
    html: baseTemplate(`
      <p>Dear ${name},</p>
      <p>Welcome to CampusPulse! Your recruiter registration for <strong>${companyName}</strong> has been received.</p>
      <p>Your account is currently pending approval from the Training and Placement Officer (TPO). You will receive another email as soon as your account is approved.</p>
    `),
  }),

  recruiterApproved: ({ companyName }) => ({
    subject: "🎉 Company Approved – CampusPulse",
    html: baseTemplate(`
      <p>Congratulations!</p>
      <p>Your recruiter account for <strong>${companyName}</strong> has been approved by the TPO.</p>
      <p>You can now log in to the CampusPulse portal to start posting job drives and scheduling placement rounds.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="http://localhost:4200/login" style="background:#1A5276; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight: bold;">Log In Now</a>
      </div>
    `),
  }),

  recruiterOnHold: ({ companyName, feedback }) => ({
    subject: "⏳ Company On Hold – CampusPulse",
    html: baseTemplate(`
      <p>Hello,</p>
      <p>Your recruiter application for <strong>${companyName}</strong> has been placed on hold by the TPO.</p>
      <p><strong>Feedback / Reason:</strong></p>
      <blockquote style="background: #f9f9f9; border-left: 4px solid #F39C12; padding: 10px 15px; margin: 10px 0;">
        ${feedback}
      </blockquote>
      <p>Please log in to your account, update your profile details as suggested, and request re-approval.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="http://localhost:4200/login" style="background:#1A5276; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight: bold;">Log In to Edit Profile</a>
      </div>
    `),
  }),

  studentScheduled: ({ studentName, companyName, roundType, date, time, location }) => ({
    subject: `📅 Upcoming Scheduled Round – ${companyName}`,
    html: baseTemplate(`
      <p>Dear ${studentName},</p>
      <p>You have been scheduled for an upcoming <strong>${roundType}</strong> round with <strong>${companyName}</strong>!</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${roundType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date(date).toDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Time Slot:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${time}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${location || "Online"}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">We wish you the best of luck!</p>
    `),
  }),

  reminder: ({ studentName, companyName, roundType, driveTitle, date, time, location }) => ({
    subject: `🔔 Reminder: Tomorrow's Round at ${companyName}`,
    html: baseTemplate(`
      <p>Hello ${studentName},</p>
      <p>This is a reminder for your upcoming <strong>${roundType}</strong> round scheduled with <strong>${companyName}</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Drive:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${driveTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Round:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${roundType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date(date).toDateString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Time Slot:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${time}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Location:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${location || "Online"}</td>
        </tr>
      </table>
      <p style="margin-top: 20px;">Make sure to be prepared and on time. Best of luck!</p>
    `),
  }),

  offerUploaded: ({ studentName, companyName }) => ({
    subject: `🎊 Congratulations! Offer Letter from ${companyName}`,
    html: baseTemplate(`
      <p>Dear ${studentName},</p>
      <p><strong>Congratulations!</strong> <strong>${companyName}</strong> has officially extended a job offer to you.</p>
      <p>Your official Offer Letter has been uploaded to the CampusPulse portal. You have <strong>7 days</strong> to log in and review/accept the offer before it expires.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="http://localhost:4200/student/applications" style="background:#1A5276; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; font-weight: bold;">View Offer</a>
      </div>
    `),
  }),

  forgotPassword: ({ name, otp }) => ({
    subject: "🔑 Password Reset Request – CampusPulse",
    html: baseTemplate(`
      <p>Hello ${name},</p>
      <p>We received a request to reset your CampusPulse password.</p>
      <p>Here is your One-Time Password (OTP):</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1A5276; background: #f4f6f7; padding: 10px 20px; border-radius: 8px; border: 1px dashed #1A5276;">${otp}</span>
      </div>
      <p style="color: #E74C3C; font-size: 14px;"><strong>Note:</strong> This OTP will expire in 15 minutes.</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
    `),
  }),
};

module.exports = emailTemplates;
