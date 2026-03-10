const express = require("express");
const router = express.Router();
const {
	createTicket,
	getUserTickets,
	getAllTickets,
	resolveTicket,
} = require("../controllers/supportController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminAuthMiddleware");

// All support routes require being logged in
router.use(authMiddleware);

router.post("/create", createTicket);
router.get("/my-tickets", getUserTickets);
// Support Management
router.get("/all-tickets", adminMiddleware, getAllTickets);
router.patch("/resolve-ticket", adminMiddleware, resolveTicket);

module.exports = router;
