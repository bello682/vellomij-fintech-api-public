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

// ============================================================
// APP INITIALIZATION
// ============================================================

const app = express();

// ============================================================
// TEMPORARY DATABASE DEBUG ROUTE
// ============================================================
//
// ⚠️ TEMPORARY — DELETE THIS ENTIRE SECTION AFTER TESTING
// We are using this to determine whether Render can directly
// connect to PostgreSQL.
//
// Test locally:
// http://localhost:8006/debug/database
//
// Test on Render:
// https://YOUR-RENDER-URL/debug/database
//
// ============================================================

app.get("/debug/database", async (req, res) => {
  try {
    const { Pool } = require("pg");

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

    const result = await pool.query("SELECT NOW()");

    await pool.end();

    res.status(200).json({
      success: true,
      message: "Database connection successful",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("DATABASE DEBUG ERROR:", error);

    res.status(500).json({
      success: false,
      code: error.code,
      message: error.message,
      address: error.address,
      port: error.port,
    });
  }
});

// ============================================================
// TRUST PROXY
// ============================================================

app.set("trust proxy", 1);

// ============================================================
// SECURITY HEADERS
// ============================================================

app.use(helmet());

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    credentials: true,

    origin: function (origin, callback) {
      const allowedOrigins = [
        // "http://192.168.0.160:8081",

        "https://fintech-mobile-app-frontend-reset-p.vercel.app",

        "https://vellomij-fintech-web-banking.vercel.app",

        "http://localhost:4123",

        "http://localhost:5173",

        "http://localhost:3000",

        "http://127.0.0.1:3000",

        "https://expo.dev/accounts/olamijidev/projects/VellomijBank/builds/007682c8-ac0c-4e60-a2dc-7a0d52f59af0",
      ];

      // Allow requests without an Origin header
      // such as Postman, mobile apps, curl, etc.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);

// ============================================================
// BODY PARSERS
// ============================================================

app.use(express.json({ extended: true }));

app.use(
  express.urlencoded({
    extended: true,
  }),
);

// ============================================================
// FILE UPLOADS
// ============================================================

app.use(
  upload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  }),
);

// ============================================================
// RATE LIMITING
// ============================================================

app.use("/Api_Url/", apiLimiter);

// ============================================================
// ROUTES
// ============================================================

// User routes
app.use("/Api_Url/FintechUsers", userRoute);

// Transaction routes
app.use("/Api_Url/FintechTransactions", userTransactionRoute);

// Admin routes
app.use("/Api_Url/FintechAdmin", adminRoute);

// Support routes
app.use("/Api_Url/FintechSupport", supportRoute);

// Bill payment routes
app.use("/Api_Url/FintechBills", billRoute);

// ============================================================
// TEMPORARY PRISMA DATABASE CONNECTION TEST
// ============================================================
//
// ⚠️ TEMPORARY — DELETE THIS FUNCTION AFTER TESTING
//
// This tests the SAME Prisma client used by your controllers.
//
// ============================================================

async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT NOW()`;

    console.log("✅ DATABASE CONNECTION SUCCESSFUL");
  } catch (error) {
    console.error("❌ DATABASE CONNECTION FAILED");

    console.error("Code:", error.code);

    console.error("Message:", error.message);

    console.error("Address:", error.address);

    console.error("Port:", error.port);
  }
}

// ============================================================
// FINAL ERROR HANDLERS
// ============================================================

app.use(notFound);

app.use(errorHandler);

// ============================================================
// DATABASE CONNECTION + SERVER START
// ============================================================

const dataBaseConnection = async () => {
  try {
    // Show only the beginning of DATABASE_URL.
    // NEVER log the complete DATABASE_URL because it contains
    // your database credentials.

    console.log(
      "Attempting to connect to database at:",
      process.env.DATABASE_URL?.substring(0, 15) + "...",
    );

    // Connect Prisma
    await prisma.$connect();

    console.log("Prisma connected to PostgreSQL (via DATABASE_URL)");

    // Start Express server
    app.listen(process.env.PORT, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  } catch (err) {
    console.error("Error connecting to the database:", err);
  }
};

// ============================================================
// START APPLICATION
// ============================================================

dataBaseConnection();

// ============================================================
// TEMPORARY PRISMA TEST
// ============================================================
//
// ⚠️ TEMPORARY — DELETE THIS LINE AFTER TESTING
//
// ============================================================

testDatabaseConnection();

// ============================================================
// EMAIL SERVICE NOTES
// ============================================================
//
// Future email migration options:
//
// 1. Resend
// 2. Postmark
// 3. SendGrid
//
// ============================================================

// ============================================================
// PRISMA STUDIO
// ============================================================
//
// To open Prisma Studio:
//
// npx prisma studio
//
// ============================================================

// ============================================================
// SECURITY REMINDER
// ============================================================
//
// NEVER put real passwords, API keys, database URLs,
// Cloudinary secrets, Stripe secrets, Paystack secrets,
// JWT secrets, or email passwords directly inside this file.
//
// Keep them inside .env locally and Environment Variables
// on Render.
//
// ============================================================
