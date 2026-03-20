# Vellomij Fintech Banking API (Production‑Style Backend)

## Overview

This project is a **secure Fintech backend API** designed to simulate the core services of a modern digital banking platform.

The system allows users to create accounts, complete identity verification (KYC), fund a wallet, transfer money, pay bills, and interact with support.  
Administrators can manage users, approve KYC, freeze accounts, monitor transactions, and analyze system metrics.

The goal of this project is to demonstrate **real-world backend engineering practices** including:

- Secure authentication
- Role‑based authorization
- Transaction integrity
- Financial audit logging
- Scalable backend architecture
- Clean error handling
- Rate‑limited sensitive endpoints

This repository represents the backend service powering a **mobile fintech wallet application**.

---

# Tech Stack

Backend

- Node.js
- Express.js

Database

- PostgreSQL
- Prisma ORM

Authentication & Security

- JWT Authentication
- Transaction PIN
- OTP Email Verification
- Express Rate Limiting

Validation

- Zod

Email Service

- Nodemailer SMTP

Payments

- Paystack

Storage

- Cloudinary (KYC document uploads)

---

# Key System Capabilities

## User Features

- Account registration
- Secure login
- Email OTP verification
- Password reset flow
- KYC identity verification
- Wallet funding
- Peer‑to‑peer transfers
- Airtime purchases
- Electricity bill payments
- Transaction history
- Transaction receipts
- Notifications system
- User dashboard analytics
- Support ticket system

---

---

### Email Service (SMTP)

The application uses **Nodemailer with Gmail SMTP** to send:

- OTP verification emails
- Password reset links

⚠️ Note:

Render blocks some outbound SMTP connections in production environments.

Therefore:

- Email sending works perfectly **locally**
- It may fail in **Render deployment**

To test email features:

1. Run the backend locally.
2. Configure `.env` with:

EMAIL_USER=your-email@gmail.com  
EMAIL_PASS=your-app-password

Alternatively, production deployments can switch to:

- SendGrid
- Mailgun
- Resend
- AWS SES

---

## Admin Features

Admins have privileged access to manage the platform.

Admin capabilities include:

- Approve or reject KYC
- Freeze or unfreeze user accounts
- Modify user daily transfer limits
- Promote users to admin
- Search and manage users
- View platform analytics
- Monitor financial activity
- Resolve support tickets

---

# Security Architecture

The API implements multiple security layers.

Authentication

- JWT based authentication
- Protected routes via middleware

Authorization

- Admin-only routes via role verification

Request Protection

- Rate limiting on login, transfers, and PIN operations

Data Validation

- Zod schema validation for all user input

Financial Safety

- Transaction PIN required for sensitive operations
- Transaction logs stored in immutable records

---

# Architecture Overview

project-root
│
├── config/
│ └── prismaClient.js
│
├── controllers/
│ ├── adminController.js
│ ├── billController.js
│ ├── supportController.js
│ ├── userController.js
│ └── userTransactionController.js
│
├── middleware/
│ ├── authMiddleware.js
│ ├── adminAuthMiddleware.js
│ ├── errorMiddleware.js
│ └── rateLimiter.js
│
├── models/
│ ├── errorModel.js
│ └── userModel.js
│
├── routers/
│ ├── adminRoutes.js
│ ├── billRoutes.js
│ ├── supportRouter.js
│ ├── userRouter.js
│ └── userTransactionRoutes.js
│
├── prisma/
│ └── schema.prisma
│
├── scripts/
│ └── seed.js
│
├── utils/
│ └── notificationHelper.js
│
├── validators/
│ └── schemaValidation.js
│
├── views/
│ └── sendOtpEmail.js
│
├── cleanup.js
├── .env
└── README.md

---

# Important Note for Testers/Recruiters

### Email Delivery in Production

This project uses **Nodemailer with Gmail SMTP** to send OTP verification emails.

However:

- Platforms like **Render block direct SMTP connections for security reasons**
- Because of this restriction, **email sending works locally but may fail in hosted environments**.

If testing this project:

Option 1 (Recommended)
Use a transactional email service such as:

- SendGrid
- Mailgun
- Resend
- Amazon SES

Option 2
Run the project locally where SMTP is not blocked.

Local testing will allow OTP verification emails to be delivered correctly.

---

---

## 🧠 Technical Challenges & Solutions

### 1. Preventing "Double-Spending" & Race Conditions

**Challenge:** In a fintech app, two simultaneous requests could potentially deduct money from an account twice before the first balance check finishes.
**Solution:** I implemented **Prisma Atomic Transactions**. By wrapping the debit and credit logic in a `$transaction` block, the database ensures that both operations succeed or both fail, maintaining a consistent ledger.

### 2. Audit Trail Integrity

**Challenge:** If a user changes their legal name, past transaction receipts would become historically inaccurate.
**Solution:** I designed a **Snapshot Pattern**. Instead of just linking to a User ID, the Transaction model stores the `senderName` and `recipientName` as strings at the moment of the transfer. This creates an unchangeable audit trail required for financial compliance.

### 3. Secure Document Handling

**Challenge:** Handling sensitive KYC documents (Passports/IDs) directly on the server is a security risk and memory hog.
**Solution:** I integrated **Cloudinary** with `express-fileupload`. Files are streamed to secure cloud storage, and only the secure URL and metadata are stored in the database, reducing server load and increasing security.

---

# Local Installation

Clone repository

git clone https://github.com/bello682/vellomij-fintech-api-public.git

cd fintech-banking-api

Install dependencies

npm install

---

# Environment Variables

Create a .env file with:

PORT=8006

JSON_WEB_TOKEN_SECRET_KEY=your_secret

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/fintech_db?schema=public

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

SUPER_ADMIN_EMAIL=admin@email.com

PAYSTACK_SECRET_KEY=your_paystack_key

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

---

# Database Setup

Run Prisma migration

npx prisma migrate dev

Generate Prisma client

npx prisma generate

---

# Start Server

node server.js

Server runs at

http://localhost:8006,
https://vellomij-fintech-api-public.onrender.com

---

---

**🧪 API Testing (Postman)**

To make testing as seamless as possible, I have included a pre-configured Postman Collection. This allows you to test all endpoints (Auth, Transfers, Admin, Bills) without manual setup.

Locate the file fintech_api_postman_collection.json in the root directory.

Open Postman and click Import.

Drag and drop the JSON file.

Configure your base_url environment variable (e.g., http://localhost:8006/Api_Url OR https://vellomij-fintech-api-public.onrender.com/Api_Url).

---

# Creating a Super Admin

After registering a user normally:

npm run seed:admin

This promotes the user defined in:

SUPER_ADMIN_EMAIL

to platform administrator.

---

# API Testing

A **Postman Collection** is included with this repository for quick testing.

Import the provided JSON file into Postman and run endpoints in this order:

1. Register
2. Login
3. Verify OTP
4. Set Transaction PIN
5. Fund Wallet
6. Transfer Funds
7. View Transactions

---

# Development Utilities

cleanup.js

Used during development to reset the database and remove test users.

Run

node cleanup.js

---

# Future Improvements

- Redis caching
- Microservices architecture
- WebSocket notifications
- Fraud detection engine
- Docker containerization
- Automated testing (Jest)
- CI/CD pipeline

---

# Author

**Bello Adetayo**

Backend Engineer focused on building secure fintech systems.
