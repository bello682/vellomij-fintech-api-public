const express = require("express");
const router = express.Router();
const {
  toggleUserFreeze,
  updateUserLimit,
  makeUserAdmin,
  searchUser,
  getAdminStats,
  updateKycStatus,
  getPendingKYCs,
} = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminAuthMiddleware");

router.patch(
  "/freeze-user/:userId",
  authMiddleware,
  adminMiddleware,
  toggleUserFreeze,
);
router.patch(
  "/update-user-limit/:userId",
  authMiddleware,
  adminMiddleware,
  updateUserLimit,
);
router.get("/search-users", authMiddleware, adminMiddleware, searchUser);
router.post("/make-user-admin", authMiddleware, adminMiddleware, makeUserAdmin);
router.get("/dashboard-stats", authMiddleware, adminMiddleware, getAdminStats);
router.patch(
  "/update-kyc-status",
  authMiddleware,
  adminMiddleware,
  updateKycStatus,
);
router.get(
  "/get-pending-kycs",
  authMiddleware,
  adminMiddleware,
  getPendingKYCs,
);

module.exports = router;
