const { Router } = require("express");

const {
	UserRegistration,
	LoginUser,
	LogoutUser,
	UpdateUserKycById,
	DeleteUserById,
	FetchUserById,
	ForgetPassword,
	ResetPassword,
	VerifyUserByOtp,
	ResendOTP,
	setTransactionPin,
	getMyNotifications,
	getUserDashboard,
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");
const { sensitiveOpLimiter } = require("../middleware/rateLimiter");

const router = Router();

// User registration route
router.post("/register", UserRegistration);

// User login route
router.post("/login", sensitiveOpLimiter, LoginUser);

// User logout route
router.post("/logout", authMiddleware, LogoutUser);

// User update kyc route
router.patch("/users/:userId/update-kyc", authMiddleware, UpdateUserKycById);

// User delete route
router.delete("/user/:id", authMiddleware, DeleteUserById);

// User fetch route
router.get("/user/:id", FetchUserById);

// User forget password route
router.post("/forgot-password", ForgetPassword);

// User reset password route
router.post("/reset-password/:token", ResetPassword);

// User verify user by email route
router.post("/verify-otp", authMiddleware, VerifyUserByOtp);

// User resend OTP route
router.post("/resend-otp", ResendOTP);

// Set transaction pin route
router.post(
	"/set-transaction-pin",
	authMiddleware,
	sensitiveOpLimiter,
	setTransactionPin
);

// Get my notifications route
router.get("/notifications", authMiddleware, getMyNotifications);

// Get user dashboard route
router.get("/dashboard", authMiddleware, getUserDashboard);

module.exports = router;

// git remote -v
