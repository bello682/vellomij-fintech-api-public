const transporter = require("./Emailtransporter");

const APP_NAME = "VELLOMIJI";
const BRAND_COLOR = "#6D28D9"; // purple — admin side
const FROM = `"${APP_NAME} Admin" <${process.env.EMAIL_USER}>`;

// ── Base layout wrapper ───────────────────────────────────────────
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${APP_NAME} Admin</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 40px;border-bottom:1px solid #334155;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${APP_NAME}</span>
                    <span style="font-size:11px;font-weight:700;color:${BRAND_COLOR};margin-left:8px;text-transform:uppercase;letter-spacing:2px;">ADMIN</span>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;color:#64748b;">Secure Admin Communication</span>
                  </td>
                </tr>
              </table>
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
            <td style="background:#0f172a;padding:20px 40px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;font-size:11px;color:#475569;">
                &copy; ${new Date().getFullYear()} ${APP_NAME} Fintech Ltd. This is a secure admin communication.<br/>
                Do not forward this email. If you did not request this, contact your system administrator immediately.
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

// ── OTP block ─────────────────────────────────────────────────────
const otpBlock = (otp) => `
  <div style="margin:24px 0;background:#1a0533;border:2px solid ${BRAND_COLOR};border-radius:10px;padding:24px;text-align:center;">
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Admin verification code</p>
    <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#ffffff;">${otp}</span>
  </div>
`;

// ── 1. Admin OTP (register / forgot password) ─────────────────────
const sendAdminOTP = async (email, otp, fullName, purpose = "verification") => {
  const isReset = purpose === "password reset";

  const html = baseTemplate(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">
      ${isReset ? "Admin Password Reset" : "Admin Account Verification"}
    </h2>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi ${fullName || "Admin"}, ${
        isReset
          ? "we received a request to reset your admin password."
          : "use the code below to complete your admin registration."
      }
    </p>
    ${otpBlock(otp)}
    <p style="margin:0 0 8px;font-size:13px;color:#64748b;">
      ⏱ This code expires in <strong style="color:#f1f5f9;">10 minutes</strong>.
    </p>
    <p style="margin:0;font-size:13px;color:#ef4444;font-weight:600;">
      🔒 Never share this code with anyone — ${APP_NAME} staff will never ask for it.
    </p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `[ADMIN] ${otp} — ${APP_NAME} ${isReset ? "password reset" : "verification"} code`,
    html,
  });
};

// ── 2. Admin Welcome (after registration) ─────────────────────────
const sendAdminWelcomeEmail = async (email, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Admin account created ✅</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi ${fullName}, your ${APP_NAME} admin account has been created and is now active. You have full access to the admin control centre.
    </p>
    <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Your access includes</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#cbd5e1;line-height:2;">
        <li>Customer management & account controls</li>
        <li>KYC verification & compliance</li>
        <li>Transaction monitoring & audit</li>
        <li>Support ticket management</li>
        <li>System analytics & reporting</li>
      </ul>
    </div>
    <p style="margin:0;font-size:12px;color:#475569;">
      For security, use a strong unique password and never share your credentials.
    </p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `[ADMIN] Welcome to ${APP_NAME} Control Centre`,
    html,
  });
};

// ── 3. Admin Password Changed Confirmation ────────────────────────
const sendAdminPasswordChangedEmail = async (email, fullName) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#f1f5f9;">Password changed successfully</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi ${fullName}, your admin account password was changed successfully at ${new Date().toLocaleString()}.
    </p>
    <div style="background:#1a1032;border:1px solid #4c1d95;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#c4b5fd;">
        ⚠️ If you did not make this change, contact your system administrator <strong>immediately</strong> and revoke access.
      </p>
    </div>
    <p style="margin:0;font-size:12px;color:#475569;">
      For security incidents, contact: security@fintch.com
    </p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `[ADMIN] Password changed — ${APP_NAME}`,
    html,
  });
};

// ── 4. Suspicious Activity Alert ─────────────────────────────────
const sendAdminSecurityAlert = async (email, fullName, details) => {
  const html = baseTemplate(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#ef4444;">Security Alert 🚨</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hi ${fullName}, suspicious activity was detected on your admin account.
    </p>
    <div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:12px;color:#ef4444;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Incident details</p>
      <p style="margin:0;font-size:13px;color:#fca5a5;">${details || "Multiple failed login attempts detected."}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      If this was you, no action is needed. If not, change your password immediately.
    </p>
  `);

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `[SECURITY ALERT] Suspicious activity — ${APP_NAME} Admin`,
    html,
  });
};

module.exports = {
  sendAdminOTP,
  sendAdminWelcomeEmail,
  sendAdminPasswordChangedEmail,
  sendAdminSecurityAlert,
};
