const express = require("express");
const router = express.Router();

const {
  registerAdmin,
  loginAdmin,
  refreshAdminToken,
  forgotPassword,
  verifyOtp,
  resendOtp,
  resetPassword,
  getMe,
} = require("../controllers/Adminauthcontroller ");

const {
  toggleUserFreeze,
  updateUserLimit,
  searchUser,
  getAdminStats,
  getPendingKYCs,
  updateKycStatus,
  getAllTransactions,
  getTransactionById,
  getAllTickets,
  replyToTicket,
  updateTicketStatus,
} = require("../controllers/adminController");

// Admin's OWN middleware — reads from prisma.admin, no user dependency
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const { sensitiveOpLimiter } = require("../middleware/rateLimiter");

// All protected admin routes use ONLY adminAuthMiddleware
const guard = [adminAuthMiddleware];

// ── Auth (public — no guard) ──────────────────────────────────────
router.post("/auth/register", sensitiveOpLimiter, registerAdmin);
router.post("/auth/login", sensitiveOpLimiter, loginAdmin);
router.post("/auth/refresh-token", sensitiveOpLimiter, refreshAdminToken);
router.post("/auth/forgot-password", sensitiveOpLimiter, forgotPassword);
router.post("/auth/verify-otp", sensitiveOpLimiter, verifyOtp);
router.post("/auth/resend-otp", sensitiveOpLimiter, resendOtp);
router.post("/auth/reset-password", sensitiveOpLimiter, resetPassword);

// ── Auth (protected) ──────────────────────────────────────────────
router.get("/auth/me", ...guard, getMe);

// ── Dashboard ─────────────────────────────────────────────────────
router.get("/dashboard-stats", ...guard, getAdminStats);

// ── User Management ───────────────────────────────────────────────
router.get("/search-users", ...guard, searchUser);
router.patch("/freeze-user/:userId", ...guard, toggleUserFreeze);
router.patch("/update-user-limit/:userId", ...guard, updateUserLimit);

// ── KYC ───────────────────────────────────────────────────────────
router.get("/get-pending-kycs", ...guard, getPendingKYCs);
router.patch("/update-kyc-status", ...guard, updateKycStatus);

// ── Transactions ──────────────────────────────────────────────────
router.get("/transactions", ...guard, getAllTransactions);
router.get("/transactions/:id", ...guard, getTransactionById);

// ── Support Tickets ───────────────────────────────────────────────
router.get("/tickets", ...guard, getAllTickets);
router.post("/tickets/:ticketId/reply", ...guard, replyToTicket);
router.patch("/tickets/:ticketId/status", ...guard, updateTicketStatus);

module.exports = router;
