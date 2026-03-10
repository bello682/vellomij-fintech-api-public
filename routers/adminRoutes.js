const express = require("express");
const router = express.Router();
const {
	updateUserLimit,
	toggleUserFreeze,
	approveKYC,
	getAllPendingKYC,
	rejectKYC,
	getSystemAnalytics,
	searchUser,
	getAdminStats,
	updateKycStatus,
	getPendingKYCs,
	makeUserAdmin,
} = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminAuthMiddleware");

// BOTH middlewares must pass: 1. Are they logged in? 2. Are they an admin?
router.patch("/approve-kyc", authMiddleware, adminMiddleware, approveKYC);
router.patch(
	"/freeze-user/:userId",
	authMiddleware,
	adminMiddleware,
	toggleUserFreeze
);
router.patch(
	"/update-user-limit/:userId",
	authMiddleware,
	adminMiddleware,
	updateUserLimit
);

router.get("/pending-kyc", authMiddleware, adminMiddleware, getAllPendingKYC);

router.patch("/reject-kyc", authMiddleware, adminMiddleware, rejectKYC);

// Only admins should see the total money in the system!
router.get(
	"/system-stats",
	authMiddleware,
	adminMiddleware,
	getSystemAnalytics
);

// route to search users
router.get("/search-users", authMiddleware, adminMiddleware, searchUser);

// route to make a user admin
router.post("/make-user-admin", authMiddleware, adminMiddleware, makeUserAdmin);

// route to get admin dashboard stats
router.get("/dashboard-stats", authMiddleware, adminMiddleware, getAdminStats);

// route to update kyc status
router.patch(
	"/update-kyc-status",
	authMiddleware,
	adminMiddleware,
	updateKycStatus
);

// route to get pending kycs
router.get(
	"/get-pending-kycs",
	authMiddleware,
	adminMiddleware,
	getPendingKYCs
);

module.exports = router;
