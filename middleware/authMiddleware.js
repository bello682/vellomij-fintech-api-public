const jwt = require("jsonwebtoken");
const HttpError = require("../models/errorModel");
const prisma = require("../confiq/prismaClient"); // Adjust this path to your prisma client file

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new HttpError("Unauthorized. No token provided.", 401));
    }

    const token = authHeader.split(" ")[1];

    // Verify token signature and expiration
    const decodedToken = jwt.verify(
      token,
      process.env.JSON_WEB_TOKEN_SECRET_KEY,
    );

    // EXTRA SECURITY: Verify user still exists in DB (solves the 'deleted user' issue)
    const userId = decodedToken.userId || decodedToken.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return next(
        new HttpError(
          "User account no longer exists. Please re-register.",
          401,
        ),
      );
    }

    // Attach user data to request
    req.user = decodedToken;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        new HttpError("Token has expired. Please log in again.", 401),
      );
    }
    return next(new HttpError("Authentication failed. Invalid token.", 401));
  }
};

module.exports = authMiddleware;
