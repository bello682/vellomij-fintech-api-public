const jwt = require("jsonwebtoken");
const HttpError = require("../models/errorModel");
const prisma = require("../confiq/prismaClient");

/**
 * Self-contained admin middleware.
 * Uses prisma.admin — completely independent from the User table.
 * Does NOT require authMiddleware to run first.
 */
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new HttpError("Unauthorized. No admin token provided.", 401));
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JSON_WEB_TOKEN_SECRET_KEY);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(
          new HttpError("Admin session expired. Please log in again.", 401),
        );
      }
      return next(new HttpError("Invalid admin token.", 401));
    }

    // generateAdminToken payload: { adminId, email, role }
    const adminId = decoded.adminId || decoded.id;

    if (!adminId) {
      return next(new HttpError("Invalid token payload.", 401));
    }

    // prisma.admin — NOT prisma.user
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        isFrozen: true,
        isDeleted: true,
      },
    });

    if (!admin) {
      return next(
        new HttpError("Admin account not found. Please log in again.", 401),
      );
    }

    if (admin.isDeleted) {
      return next(new HttpError("This admin account has been deleted.", 403));
    }

    if (admin.isFrozen) {
      return next(new HttpError("This admin account has been suspended.", 403));
    }

    if (admin.status !== "active") {
      return next(new HttpError("This admin account is not active.", 403));
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin Middleware Error:", error);
    return next(new HttpError("Admin authentication failed.", 500));
  }
};

module.exports = adminAuthMiddleware;
