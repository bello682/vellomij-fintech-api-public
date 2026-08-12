const transporter = require("./Emailtransporter");

const APP_NAME = "VELLOMIJI";
const BRAND_COLOR = "#10B981"; // emerald — user side
const FROM = `"${APP_NAME}" <${process.env.EMAIL_USER}>`;

// ── Base layout wrapper ───────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_COLOR};padding:28px 40px;text-align:center;">
              <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${APP_NAME}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e8ecf0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                &copy; ${new Date().getFullYear()} ${APP_NAME} Fintech Ltd. All rights reserved.<br/>
                If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ── OTP block shared component ────────────────────────────────────
const otpBlock = (otp) => `
  <div style="margin:24px 0;background:#f0fdf4;border:2px dashed ${BRAND_COLOR};border-radius:10px;padding:20px;text-align:center;">
    <p style="margin:0 0 6px;font-size:13px;color:#64748b;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Your verification code</p>
    <span style="font-size:38px;font-weight:800;letter-spacing:10px;color:#0f172a;">${otp}</span>
  </div>
`;

// ── 1. Account Verification OTP ───────────────────────────────────
const sendVerificationOTP = async (email, otp, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Verify your account</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName || "there"}, welcome to ${APP_NAME}! Use the code below to verify your email address.
    </p>
    ${otpBlock(otp)}
    <p style="margin:0;font-size:13px;color:#94a3b8;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `${otp} is your ${APP_NAME} verification code`,
    html,
  });
};

// ── 2. Password Reset OTP ─────────────────────────────────────────
const sendPasswordResetOTP = async (email, otp, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Reset your password</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName || "there"}, we received a request to reset your ${APP_NAME} password. Use the code below.
    </p>
    ${otpBlock(otp)}
    <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">This code expires in <strong>10 minutes</strong>.</p>
    <p style="margin:0;font-size:13px;color:#ef4444;">If you did not request a password reset, please contact support immediately.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Reset your ${APP_NAME} password`,
    html,
  });
};

// ── 3. Welcome email (after successful verification) ──────────────
const sendWelcomeEmail = async (email, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Welcome to ${APP_NAME}! 🎉</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName}, your account is now verified and ready to use. You can now make transfers, pay bills, and manage your finances seamlessly.
    </p>
    <div style="background:#f0fdf4;border-left:4px solid ${BRAND_COLOR};border-radius:4px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:#0f172a;font-weight:600;">What's next?</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#475569;line-height:1.8;">
        <li>Complete your KYC verification to unlock higher transfer limits</li>
        <li>Set up your transaction PIN</li>
        <li>Make your first transfer</li>
      </ul>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Need help? Contact us at support@fintch.com</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Welcome to ${APP_NAME} — you're all set!`,
    html,
  });
};

// ── 4. KYC Approved ───────────────────────────────────────────────
const sendKYCApprovedEmail = async (email, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">KYC Approved! ✅</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName}, your identity has been successfully verified. You now have access to full transfer limits on ${APP_NAME}.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
      <span style="font-size:48px;">🎉</span>
      <p style="margin:8px 0 0;font-size:15px;font-weight:700;color:#0f172a;">Your account is fully verified</p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Thank you for completing your verification on ${APP_NAME}.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Your ${APP_NAME} identity has been verified`,
    html,
  });
};

// ── 5. KYC Rejected ───────────────────────────────────────────────
const sendKYCRejectedEmail = async (email, fullName, reason) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">KYC Verification Update ⚠️</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName}, unfortunately we were unable to verify your identity. Please review the reason below and re-submit your documents.
    </p>
    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#ef4444;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Reason for rejection</p>
      <p style="margin:0;font-size:14px;color:#0f172a;">${reason || "Documents were unclear or invalid. Please re-upload valid government-issued ID."}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Log in to your ${APP_NAME} account to re-submit your KYC documents.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Action required: ${APP_NAME} KYC verification`,
    html,
  });
};

// ── 6. Transaction Credit Alert ───────────────────────────────────
const sendCreditAlert = async (email, fullName, amount, senderName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Money Received 💰</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName}, you have received a transfer to your ${APP_NAME} account.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Amount received</p>
      <p style="margin:0;font-size:36px;font-weight:800;color:${BRAND_COLOR};">₦${Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">From: <strong style="color:#0f172a;">${senderName}</strong></p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">If you did not expect this transfer, please contact support.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `You received ₦${Number(amount).toLocaleString()} on ${APP_NAME}`,
    html,
  });
};

// ── 7. Transaction Debit Alert ────────────────────────────────────
const sendDebitAlert = async (email, fullName, amount, recipientName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Transfer Successful</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName}, your transfer has been processed successfully.
    </p>
    <div style="background:#f8fafc;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Amount sent</p>
      <p style="margin:0;font-size:36px;font-weight:800;color:#ef4444;">₦${Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">To: <strong style="color:#0f172a;">${recipientName}</strong></p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">If you did not initiate this transfer, contact support immediately.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Transfer of ₦${Number(amount).toLocaleString()} sent — ${APP_NAME}`,
    html,
  });
};

// ── 8. Account Frozen Alert ───────────────────────────────────────
const sendAccountFrozenEmail = async (email, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Account Frozen ❄️</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Hi ${fullName}, your ${APP_NAME} account has been temporarily frozen by our compliance team.
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      If you believe this is an error, please contact our support team immediately at <strong>support@fintch.com</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#94a3b8;">Your funds are safe and secure.</p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Important: Your ${APP_NAME} account has been frozen`,
    html,
  });
};

module.exports = {
  sendVerificationOTP,
  sendPasswordResetOTP,
  sendWelcomeEmail,
  sendKYCApprovedEmail,
  sendKYCRejectedEmail,
  sendCreditAlert,
  sendDebitAlert,
  sendAccountFrozenEmail,
};
