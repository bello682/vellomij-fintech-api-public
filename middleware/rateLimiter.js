const rateLimit = require("express-rate-limit");

// General limit for all API requests
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per window
	message: {
		message:
			"Too many requests from this IP, please try again after 15 minutes",
		status: 429,
	},
	standardHeaders: true,
	legacyHeaders: false,
});

// Strict limit for sensitive operations (Login, Transfers, PIN change)
const sensitiveOpLimiter = rateLimit({
	// windowMs: 60 * 60 * 1000, // 1 hour
	windowMs: 1 * 60 * 1000, // 1 minute (60,000 ms)
	max: 5, // Only 5 failed attempts/requests allowed per hour
	message: {
		message:
			"Too many attempts. For security reasons, please try again in an hour.",
		// "Too many attempts. Testing mode: please try again in 1 minute.",
		status: 429,
	},
	standardHeaders: true,
	legacyHeaders: false,
});

module.exports = { apiLimiter, sensitiveOpLimiter };
