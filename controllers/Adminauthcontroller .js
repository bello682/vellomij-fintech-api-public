const HttpError = require("../models/errorModel");
const prisma = require("../confiq/prismaClient");
const generateAdminToken = require("../constants/generateAdminToken");
const {
  sendAdminOTP,
  sendAdminPasswordChangedEmail,
  sendAdminSecurityAlert,
  sendAdminWelcomeEmail,
} = require("../views/Adminemails ");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// ── Helpers ───────────────────────────────────────────────────────

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// const sendAdminOTP = async (email, otp, purpose = "verification") => {
//   // TODO: replace with Resend / Postmark / SendGrid
//   console.log(`\n🔐 ADMIN OTP [${purpose}] → ${email}: ${otp}\n`);
// };

// ── REGISTER ──────────────────────────────────────────────────────
const registerAdmin = async (req, res, next) => {
  const { fullName, email, password, superAdminSecret } = req.body;

  try {
    if (superAdminSecret !== process.env.SUPER_ADMIN_SECRET) {
      return next(new HttpError("Invalid registration secret.", 403));
    }
    if (!fullName || !email || !password) {
      return next(
        new HttpError("Full name, email and password are required.", 400),
      );
    }
    if (password.length < 8) {
      return next(
        new HttpError("Password must be at least 8 characters.", 400),
      );
    }

    // Uses prisma.admin — the dedicated admin model
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      return next(
        new HttpError("An account with this email already exists.", 409),
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        verification_status: "verified",
        status: "active",
      },
    });

    const token = generateAdminToken(
      { id: admin.id, adminId: admin.id, email: admin.email, role: admin.role },
      "8h",
    );

    res.status(201).json({
      success: true,
      message: "Admin account created successfully.",
      token,
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Admin Register Error:", err);
    next(new HttpError("Registration failed.", 500));
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────
const loginAdmin = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return next(new HttpError("Email and password are required.", 400));
    }

    // prisma.admin — completely separate from User table
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      return next(
        new HttpError("Invalid credentials or insufficient privileges.", 401),
      );
    }

    if (admin.isDeleted) {
      return next(new HttpError("This account has been deactivated.", 403));
    }

    if (admin.isFrozen) {
      return next(new HttpError("This account has been suspended.", 403));
    }

    if (admin.status !== "active") {
      return next(new HttpError("This account is not active.", 403));
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return next(
        new HttpError("Invalid credentials or insufficient privileges.", 401),
      );
    }

    const token = generateAdminToken(
      { id: admin.id, adminId: admin.id, email: admin.email, role: admin.role },
      "8h",
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (err) {
    console.error("Admin Login Error:", err);
    next(new HttpError("Login failed.", 500));
  }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────
const refreshAdminToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new HttpError("Token is required.", 401));
    }

    const oldToken = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(oldToken, process.env.JSON_WEB_TOKEN_SECRET_KEY, {
        ignoreExpiration: true,
      });
    } catch {
      return next(new HttpError("Invalid token.", 401));
    }

    const adminId = decoded.adminId || decoded.id;
    if (!adminId) {
      return next(new HttpError("Invalid token payload.", 401));
    }

    // Verify admin still exists and is active in the admin table
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!admin) return next(new HttpError("Admin account not found.", 401));
    if (admin.isDeleted)
      return next(new HttpError("Account has been deactivated.", 403));
    if (admin.isFrozen)
      return next(new HttpError("Account has been suspended.", 403));
    if (admin.status !== "active")
      return next(new HttpError("Account is not active.", 403));

    const newToken = generateAdminToken(
      { id: admin.id, adminId: admin.id, email: admin.email, role: admin.role },
      "8h",
    );

    res.status(200).json({ success: true, token: newToken });
  } catch (err) {
    console.error("Admin Refresh Token Error:", err);
    next(new HttpError("Could not refresh token.", 401));
  }
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) return next(new HttpError("Email is required.", 400));

    const admin = await prisma.admin.findUnique({ where: { email } });

    // Same response whether found or not — don't leak existence
    if (!admin) {
      return res.status(200).json({
        success: true,
        message: "If this email belongs to an admin, an OTP has been sent.",
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.admin.update({
      where: { email },
      data: { otp: hashedOtp, otpExpiresAt: expiresAt },
    });

    await sendAdminOTP(email, otp, "password reset");

    res.status(200).json({
      success: true,
      message: "If this email belongs to an admin, an OTP has been sent.",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    next(new HttpError("Failed to process request.", 500));
  }
};

// ── VERIFY OTP ────────────────────────────────────────────────────
const verifyOtp = async (req, res, next) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return next(new HttpError("Email and OTP are required.", 400));
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      return next(new HttpError("Invalid request.", 400));
    }

    if (!admin.otpExpiresAt || new Date() > new Date(admin.otpExpiresAt)) {
      return next(
        new HttpError("OTP has expired. Please request a new one.", 400),
      );
    }

    if (!admin.otp) {
      return next(
        new HttpError("No OTP found. Please request a new one.", 400),
      );
    }

    const isMatch = await bcrypt.compare(otp, admin.otp);
    if (!isMatch) {
      return next(new HttpError("Invalid OTP.", 400));
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedReset = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetExp = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await prisma.admin.update({
      where: { email },
      data: {
        otp: null,
        otpExpiresAt: null,
        resetPasswordToken: hashedReset,
        resetPasswordExpiresAt: resetExp,
      },
    });

    res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
      resetToken,
    });
  } catch (err) {
    console.error("Verify OTP Error:", err);
    next(new HttpError("OTP verification failed.", 500));
  }
};

// ── RESEND OTP ────────────────────────────────────────────────────
const resendOtp = async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) return next(new HttpError("Email is required.", 400));

    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      return res.status(200).json({
        success: true,
        message: "If this email belongs to an admin, a new OTP has been sent.",
      });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const hashedOtp = await bcrypt.hash(otp, 10);

    await prisma.admin.update({
      where: { email },
      data: { otp: hashedOtp, otpExpiresAt: expiresAt },
    });

    await sendAdminOTP(email, otp, "verification");

    res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email.",
    });
  } catch (err) {
    console.error("Resend OTP Error:", err);
    next(new HttpError("Failed to resend OTP.", 500));
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  const { email, resetToken, password } = req.body;

  try {
    if (!email || !resetToken || !password) {
      return next(
        new HttpError(
          "Email, reset token, and new password are required.",
          400,
        ),
      );
    }
    if (password.length < 8) {
      return next(
        new HttpError("Password must be at least 8 characters.", 400),
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return next(new HttpError("Invalid request.", 400));
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    if (admin.resetPasswordToken !== hashedToken) {
      return next(new HttpError("Invalid or expired reset token.", 400));
    }

    if (
      !admin.resetPasswordExpiresAt ||
      new Date() > new Date(admin.resetPasswordExpiresAt)
    ) {
      return next(
        new HttpError("Reset token has expired. Please start again.", 400),
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.admin.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in.",
    });
  } catch (err) {
    console.error("Reset Password Error:", err);
    next(new HttpError("Password reset failed.", 500));
  }
};

// ── GET ME ────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.admin is set by adminAuthMiddleware
    const adminId = req.admin?.id;

    if (!adminId) {
      return next(new HttpError("Admin authentication required.", 401));
    }

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isVerified: true,
        verification_status: true,
        status: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return next(new HttpError("Admin not found.", 404));
    }

    res.status(200).json({ success: true, data: admin });
  } catch (err) {
    console.error("Get Me Error:", err);
    next(new HttpError("Could not fetch admin profile.", 500));
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  refreshAdminToken,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  getMe,
};
