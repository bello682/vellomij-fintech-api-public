const prisma = require("../confiq/prismaClient");
const HttpError = require("../models/errorModel");

const adminMiddleware = async (req, res, next) => {
	try {
		// 1. Get the ID from the decoded token (attached by authMiddleware)
		const userId = req.user.userId || req.user.id;

		// 2. Look up the user in the database to get their CURRENT status
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { isAdmin: true }, // We only need this field
		});

		// 3. Verify
		if (user && user.isAdmin === true) {
			return next();
		}

		return next(
			new HttpError("Access denied. Admin privileges required.", 403)
		);
	} catch (err) {
		next(new HttpError("Admin verification failed.", 500));
	}
};
module.exports = adminMiddleware;
