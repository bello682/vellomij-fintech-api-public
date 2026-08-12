const prisma = require("../confiq/prismaClient");
const HttpError = require("../models/errorModel");

// Get all notifications for logged-in user
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    next(new HttpError("Failed to load notifications.", 500));
  }
};

// Mark one notification as read
const markNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        isRead: true,
      },
    });

    if (notification.count === 0) {
      return next(new HttpError("Notification not found.", 404));
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Mark Notification Error:", error);
    next(new HttpError("Failed to update notification.", 500));
  }
};

// Mark all notifications as read
const markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Mark All Notifications Error:", error);
    next(new HttpError("Failed to update notifications.", 500));
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
