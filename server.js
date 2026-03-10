// Server.js

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const prisma = require("./confiq/prismaClient");
const upload = require("express-fileupload");
const path = require("path");
const helmet = require("helmet");

// Import routes and middlewares
const userRoute = require("./routers/userRouter");
const userTransactionRoute = require("./routers/userTransactionRoutes");
const adminRoute = require("./routers/adminRoutes");
const supportRoute = require("./routers/supportRouter");
const billRoute = require("./routers/billRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();

// 1. Security Headers first
// Adds security headers to protect against common web vulnerabilities
app.use(helmet());

app.use(
	cors({
		credentials: true,
		origin: function (origin, callback) {
			const allowedOrigins = [
				// "*",
				"http://192.168.0.160:8081",
				"https://fintech-mobile-app-frontend-reset-p.vercel.app",
				"http://localhost:4123",
			];
			if (!origin || allowedOrigins.indexOf(origin) !== -1) {
				callback(null, true);
			} else {
				callback(new Error("Not allowed by CORS"));
			}
		},
	})
);

// 2. Body Parsers
// Middleware configuration
app.use(express.json({ extended: true }));
app.use(express.urlencoded({ extended: true }));

//  for accepting post from formData
// const bodyParser = require('express').json;
// app.use(bodyParser());

// 3. File Uploads
// Configure express-fileupload with temp files support
app.use(
	upload({
		useTempFiles: true,
		tempFileDir: "/tmp/", // Temporary directory for file uploads
	})
);

// 4. Rate Limiting (MUST be before routes to catch them)
// Apply rate limiting to all API routes
app.use("/Api_Url/", apiLimiter);

// 5. Routes
// Main user routes
app.use("/Api_Url/FintechUsers", userRoute);
app.use("/Api_Url/FintechTransactions", userTransactionRoute);
app.use("/Api_Url/FintechAdmin", adminRoute);
app.use("/Api_Url/FintechSupport", supportRoute);
app.use("/Api_Url/FintechBills", billRoute);

// 6. Final Error Handlers (MUST be last)
// Error handling middlewares
app.use(notFound);
app.use(errorHandler);

// Database connection and server start
const dataBaseConnection = async () => {
	try {
		await prisma.$connect();
		console.log("Prisma connected to PostgreSQL (via DATABASE_URL)");

		app.listen(process.env.PORT, () => {
			console.log(`Server is running on port ${process.env.PORT}`);
		});
	} catch (err) {
		console.error("Error connecting to the database:", err);
	}
};

dataBaseConnection();

// options for sending email i will migrate to are

// The Services to Remember
// Here are the three I recommend you keep in your notes for when we do the "Big Migration":

// Resend: (My top choice for clean code and 1-second delivery).

// Postmark: (The "Gold Standard" for transactional emails like OTPs and password resets).

// SendGrid: (What you already have—very powerful, but requires careful domain verification to avoid the spam folder).

// Always use this "npx prisma studio" command to view and manage your database with Prisma Studio.
// npx prisma studio

// Remember to keep your environment variables secure and never expose them in your codebase!
// Also, consider setting up logging and monitoring for your server to track performance and errors.
// Finally, ensure you have proper testing in place for your routes and middleware to maintain code quality.
