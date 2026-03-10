const { Router } = require("express");

const {
	transferMoney,
	fundWallet,
	getTransactionHistory,
	verifyAccountNumber,
	// getDashboardStats,
	getTransactionReceipt,
} = require("../controllers/userTransactionController");

const authMiddleware = require("../middleware/authMiddleware");
const { sensitiveOpLimiter } = require("../middleware/rateLimiter");

const router = Router();

// Apply authMiddleware to all routes in this file
router.use(authMiddleware);

// Only logged-in users can transfer money
router.post("/transfer", sensitiveOpLimiter, transferMoney);
router.post("/fund", fundWallet);
router.get("/history", getTransactionHistory);
router.post("/verify-account", verifyAccountNumber);
// router.get("/dashboard-stats", getDashboardStats);
router.get("/receipt/:transactionId", getTransactionReceipt);

module.exports = router;

// git remote -v
