const prisma = require("../confiq/prismaClient");
const cloudinary = require("cloudinary").v2;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const HttpError = require("../models/errorModel");
const sendOTPEmail = require("../views/sendOtpEmail.js");
const generateToken = require("../constants/generateToken.js");
const {
  registrationSchema,
  loginSchema,
  kycSchema,
} = require("../Zod-Schema-Validation/schemaValidation.js");

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- UTILITIES ---
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateAccountNumber = () => {
  // Generates a 10-digit account number starting with '22'
  return "22" + Math.floor(10000000 + Math.random() * 90000000).toString();
};

const sendPasswordResetEmail = async (email, resetToken) => {
  const nodemailer = require("nodemailer");
  const resetLink = `${process.env.WEBSITE_URL}/reset-password/${resetToken}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Flatter HTML structure (faster for scanners to parse)
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #f4f7f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e1e4e8;">
            <div style="background-color: #001f3f; padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px;">FINTECH APP</h1>
            </div>
            <div style="padding: 30px;">
                <h2 style="color: #333333; font-size: 18px;">Password Reset Request</h2>
                <p style="color: #555555; line-height: 1.5;">We received a request to reset your password. Click the button below to proceed. This link expires in 1 hour.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #888888; font-size: 12px;">If you did not request this, please ignore this email.</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 11px; color: #999999;">
                © 2026 Fintech App Inc. Lekki, Lagos.
            </div>
        </div>
    </div>
    `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER, // Removed friendly name for faster verification
    to: email,
    subject: "Reset Your Password",
    text: `Reset your password here: ${resetLink}`, // IMPORTANT: Plain text fallback speeds up delivery
    html: emailHtml,
  });
};

const UserRegistration = async (req, res, next) => {
  try {
    registrationSchema.parse(req.body);
    const email = req.body.email?.toLowerCase().trim();
    const { fullName, password } = req.body;

    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: { bankInfo: true },
    });

    // 2. If user exists AND is already verified, block them.
    if (existingUser && existingUser.isVerified) {
      return next(
        new HttpError(
          "Email already exists and is verified. Please login.",
          400,
        ),
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    let user;

    if (existingUser && !existingUser.isVerified) {
      // 3. RECOVERY LOGIC: If user exists but NOT verified, update them with new OTP
      // This fixes the "Network Error" issue you just had.
      user = await prisma.user.update({
        where: { email },
        data: {
          fullName,
          password: hashedPassword,
          otp,
          otpExpiresAt,
        },
        include: { bankInfo: true },
      });
    } else {
      // 4. NEW REGISTRATION: Create from scratch
      user = await prisma.$transaction(async (tx) => {
        return await tx.user.create({
          data: {
            fullName,
            email,
            password: hashedPassword,
            otp,
            otpExpiresAt,
            bankInfo: {
              create: {
                accountNumber: generateAccountNumber(),
                bankName: "Vellomij Bank",
              },
            },
          },
          include: { bankInfo: true },
        });
      });
    }

    // 5. Send Email (If this fails, the catch block handles it)
    await sendOTPEmail(user.email, otp, user.fullName);

    const token = generateToken(user);

    res.status(201).json({
      message: "OTP sent to your email.",
      token,
      user: {
        email: user.email,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    // If validation fails or database crashes
    const message = err.errors ? err.errors[0].message : err.message;
    console.log(message);
    next(new HttpError(message, 500));
  }
};

const VerifyUserByOtp = async (req, res, next) => {
  const { otp } = req.body;
  try {
    // Because of authMiddleware, we already have the user ID!
    const userId = req.user.userId || req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // 1. Validation
    if (!user || user.otp !== otp) {
      return next(new HttpError("Invalid OTP code.", 400));
    }

    if (new Date() > user.otpExpiresAt) {
      return next(
        new HttpError("OTP has expired. Please request a new one.", 400),
      );
    }

    // 2. Update User
    await prisma.user.update({
      where: { id: userId },
      data: {
        isVerified: true,
        otp: null,
        otpExpiresAt: null,
        status: "active",
      },
    });

    res.json({
      status: "success",
      message: `Welcome ${user.fullName}! Your account has been verified successfully.`,
    });
  } catch (err) {
    next(new HttpError(err.message, 500));
  }
};

// 3. RESEND OTP
const ResendOTP = async (req, res, next) => {
  // const { email } = req.body;
  const email = req.body.email?.toLowerCase().trim();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return next(new HttpError("User not found", 404));
    if (user.isVerified)
      return next(new HttpError("User already verified", 400));

    const newOtp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { otp: newOtp, otpExpiresAt },
    });

    await sendOTPEmail(email, newOtp);
    const token = generateToken(user);

    res.json({ message: "A new OTP has been sent.", token });
  } catch (err) {
    console.log("Error resending OTP:", err.message);
    next(new HttpError(err.message, 500));
  }
};

// 4. LOGIN
const LoginUser = async (req, res, next) => {
  try {
    // VALIDATION STEP
    // This will throw an error automatically if req.body is missing fields
    loginSchema.parse(req.body);

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { bankInfo: true },
    });

    // 1. Check if user exists first
    if (!user) return next(new HttpError("Invalid credentials", 401));

    // 2. Check if deleted (prevents bcrypt work for closed accounts)
    if (user.isDeleted) {
      return next(
        new HttpError(
          "This account has been closed. Please contact support to reactivate.",
          403,
        ),
      );
    }

    // 3. Now do the heavy lifting (bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return next(new HttpError("Invalid credentials", 401));

    if (user.isFrozen) {
      return next(
        new HttpError("Your account is frozen. Contact support.", 403),
      );
    }

    if (!user.isVerified) return next(new HttpError("Email not verified", 403));

    // const token = jwt.sign(
    // 	{
    // 		userId: user.id,
    // 		email: user.email,
    // 		role: user.role,
    // 		isAdmin: user.isAdmin,
    // 	},
    // 	process.env.JSON_WEB_TOKEN_SECRET_KEY,
    // 	{ expiresIn: "2h" }
    // );
    const token = generateToken(user, "2h");

    console.log("LOGIN DEBUG - User isAdmin from DB:", user.isAdmin);

    res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        accountNumber: user.bankInfo?.accountNumber,
        balance: user.bankInfo?.balance,
        role: user.role,
        isAdmin: user.isAdmin, // to check if it admin user is the one logged in
        status: user.status,
      },
      token,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      // Returns the first validation error message (e.g., "Email is required")
      return next(new HttpError(err.errors[0].message, 400));
    }
    next(
      new HttpError(`${err.message || "Login failed, please try again."}`, 500),
    );
  }
};

// 5. FORGET PASSWORD
const ForgetPassword = async (req, res, next) => {
  const email = req.body.email?.toLowerCase().trim();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return next(new HttpError("No account found with this email.", 404));

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { email },
      data: { resetPasswordToken: resetToken, resetPasswordExpiresAt: expires },
    });

    await sendPasswordResetEmail(email, resetToken);
    res.json({ message: "Reset link sent to your email." });
  } catch (err) {
    next(new HttpError(err.message, 500));
  }
};

// 6. RESET PASSWORD
const ResetPassword = async (req, res, next) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiresAt: { gt: new Date() },
      },
    });

    if (!user) return next(new HttpError("Invalid or expired token", 400));

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });

    res.json({ message: "Password reset successful." });
  } catch (err) {
    next(new HttpError(err.message, 500));
  }
};

// 7. UPDATE KYC
const UpdateUserKycById = async (req, res, next) => {
  try {
    // 1. Validate Schema
    kycSchema.parse(req.body);

    if (!req.user) {
      return next(new HttpError("Authentication required.", 401));
    }

    const urlId = req.params.userId;
    const tokenId = req.user.userId || req.user.id;

    // 2. Strict Ownership Check (Prevents IDOR attacks)
    if (urlId !== tokenId) {
      return next(
        new HttpError(
          "Access denied. You can only update your own KYC records.",
          403,
        ),
      );
    }

    const {
      documentType,
      occupation,
      address,
      dateOfBirth,
      bvn,
      phoneNumber,
      placeOfWork,
    } = req.body;

    // 3. BVN Uniqueness Check (Check if someone else uses this BVN)
    const existingBvnOwner = await prisma.kyc.findFirst({
      where: {
        bvn: bvn,
        NOT: { userId: tokenId },
      },
    });

    if (existingBvnOwner) {
      return next(
        new HttpError("This BVN is already linked to another account.", 400),
      );
    }

    // 4. File Upload Check
    if (!req.files || !req.files.documentImage) {
      return next(
        new HttpError("Document image is required for verification.", 400),
      );
    }

    // 5. Upload to Cloudinary
    const upload = await cloudinary.uploader.upload(
      req.files.documentImage.tempFilePath,
      { folder: "kyc_documents" },
    );

    // 6. ATOMIC TRANSACTION (Banking Standard)
    const [kyc] = await prisma.$transaction([
      // Task 1: Create or Update KYC
      prisma.kyc.upsert({
        where: { userId: tokenId },
        update: {
          documentType,
          documentImage: upload.secure_url,
          occupation,
          address,
          bvn,
          phoneNumber,
          placeOfWork,
        },
        create: {
          userId: tokenId,
          documentType,
          documentImage: upload.secure_url,
          occupation,
          address,
          dateOfBirth: new Date(dateOfBirth),
          bvn,
          phoneNumber,
          placeOfWork,
        },
      }),
      // Task 2: Update User Verification Status
      prisma.user.update({
        where: { id: tokenId },
        data: { verification_status: "pending" },
      }),
    ]);

    res.status(200).json({
      status: "success",
      message:
        "KYC submitted successfully. Your account is now being reviewed.",
      data: kyc,
    });
  } catch (err) {
    // Handle Prisma specific errors (Foreign Keys, Unique constraints)
    if (err.code === "P2003") {
      return next(
        new HttpError("Account record not found. Please log in again.", 404),
      );
    }
    if (err.code === "P2002") {
      return next(
        new HttpError("A record with this BVN or Phone already exists.", 400),
      );
    }

    console.error("KYC SUBMISSION ERROR:", err);
    next(new HttpError(err.message || "An internal error occurred", 500));
  }
};

// 8. FETCH USER
const FetchUserById = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { bankInfo: true, kyc: true },
    });
    if (!user) return next(new HttpError("User not found", 404));

    const { password, otp, resetPasswordToken, ...safeData } = user;
    res.json({ success: true, data: safeData });
  } catch (err) {
    next(new HttpError(err.message, 500));
  }
};

// 9. DELETE USER
const DeleteUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;

    // 1. Check if user exists and has 0 balance (Production safety)
    const userBank = await prisma.bankInfo.findUnique({ where: { userId } });
    if (userBank && userBank.balance > 0) {
      return next(
        new HttpError(
          "Cannot delete account with an active balance. Please withdraw funds first.",
          400,
        ),
      );
    }

    // 2. Perform Soft Delete
    await prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: "deleted", // Update status for easy filtering
      },
    });

    res.json({
      success: true,
      message: "User account deactivated and scheduled for closure.",
    });
  } catch (err) {
    next(new HttpError("Account deactivation failed.", 500));
  }
};

// 10. LOGOUT
const LogoutUser = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { status: "inactive" },
    });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(new HttpError(err.message, 500));
  }
};

const setTransactionPin = async (req, res, next) => {
  const { pin } = req.body;
  // Extract userId safely from the auth middleware
  const userId = req.user?.userId || req.user?.id;

  if (!userId) {
    return next(new HttpError("User not authenticated.", 401));
  }

  try {
    // Validation: Ensure it is exactly 4 digits (e.g., "1234")
    if (!/^\d{4}$/.test(String(pin))) {
      return next(new HttpError("PIN must be exactly 4 digits.", 400));
    }

    // Hash the PIN just like a password
    const hashedPin = await bcrypt.hash(String(pin), 12);

    // Update the user record
    await prisma.user.update({
      where: { id: userId },
      data: { transactionPin: hashedPin },
    });

    res.status(200).json({
      success: true,
      message:
        "Transaction PIN set successfully. You can now perform transfers.",
    });
  } catch (err) {
    next(new HttpError("Could not save PIN. Please try again later.", 500));
  }
};

const getMyNotifications = async (req, res, next) => {
  const userId = req.user.userId || req.user.id;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20, // Only show the last 20
    });

    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    next(new HttpError("Could not fetch notifications.", 500));
  }
};

const getUserDashboard = async (req, res, next) => {
  const userId = req.user.userId || req.user.id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    const [
      user,
      totalOutflow,
      totalInflow,
      recentNotifications,
      spendBreakdown,
    ] = await Promise.all([
      // 1. User Profile & Wallet
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          bankInfo: { select: { balance: true, accountNumber: true } },
        },
      }),

      // 2. Total Outflow (Sum of all debits)
      prisma.transaction.aggregate({
        where: {
          senderId: userId,
          status: "COMPLETED",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // 3. Total Inflow (Sum of all credits)
      prisma.transaction.aggregate({
        where: {
          receiverId: userId,
          status: "COMPLETED",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),

      // 4. Recent Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),

      // 5. NEW: Spend Breakdown by Category
      // Grouping all debit transactions this month by their category
      prisma.transaction.groupBy({
        by: ["category"],
        where: {
          senderId: userId,
          status: "COMPLETED",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    if (!user) return next(new HttpError("User not found.", 404));

    // Format the breakdown for the frontend (e.g., { "Utilities": 5000, "General": 2000 })
    const formattedBreakdown = spendBreakdown.map((item) => ({
      category: item.category,
      total: item._sum.amount || 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        user: {
          fullName: user.fullName,
          email: user.email,
          accountNumber: user.bankInfo?.accountNumber,
          balance: user.bankInfo?.balance || 0,
          verificationStatus: user.verification_status,
          isFrozen: user.isFrozen,
          dailyLimit: user.dailyTransferLimit,
        },
        analytics: {
          month: now.toLocaleString("default", { month: "long" }),
          totalInflow: totalInflow._sum.amount || 0,
          totalOutflow: totalOutflow._sum.amount || 0,
          currency: "NGN",
          breakdown: formattedBreakdown, // <-- Added this
        },
        notifications: recentNotifications,
      },
    });
  } catch (err) {
    next(new HttpError("Failed to fetch dashboard data.", 500));
  }
};

module.exports = {
  UserRegistration,
  LoginUser,
  UpdateUserKycById,
  ForgetPassword,
  VerifyUserByOtp,
  ResendOTP,
  DeleteUserById,
  LogoutUser,
  getUserDashboard,
  FetchUserById,

  ResetPassword,
  setTransactionPin,
  getMyNotifications,
};
