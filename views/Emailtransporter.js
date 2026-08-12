const nodemailer = require("nodemailer");

/**
 * Single shared transporter — created once, reused everywhere.
 * Uses Gmail. For production scale, swap to Resend / Postmark / SendGrid
 * by changing the transport config below — templates stay the same.
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use Gmail App Password, not your login password
  },
});

// Verify connection on startup (optional but helpful)
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email transporter error:", error.message);
  } else {
    console.log("✅ Email transporter ready");
  }
});

module.exports = transporter;
