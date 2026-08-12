const express = require("express");

const router = express.Router();

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");

const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getNotifications);

router.patch("/:id/read", authMiddleware, markNotificationRead);

router.patch("/read-all", authMiddleware, markAllNotificationsRead);

module.exports = router;
