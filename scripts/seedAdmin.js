require("dotenv").config();
const prisma = require("../confiq/prismaClient");

// We explicitly pass the datasource URL to avoid the "empty options" error
async function main() {
	const adminEmail = process.env.SUPER_ADMIN_EMAIL;

	if (!adminEmail) {
		console.error("❌ Error: SUPER_ADMIN_EMAIL not found in .env file");
		process.exit(1);
	}

	console.log(`🚀 Attempting to promote ${adminEmail} to Super Admin...`);

	try {
		const user = await prisma.user.update({
			where: { email: adminEmail },
			data: {
				isAdmin: true,
				role: "admin",
				isVerified: true,
				verification_status: "verified",
			},
		});
		console.log(`✅ Success! ${user.fullName} is now a Super Admin.`);
	} catch (error) {
		if (error.code === "P2025") {
			console.error(
				"❌ Error: That email does not exist in the database. Please register the user first."
			);
		} else {
			console.error("❌ Database Error:", error.message);
		}
	} finally {
		await prisma.$disconnect();
	}
}

main();

// THW PURPOSE OF THIS SCRIPT: This is a standalone script to seed a Super Admin user into the database. it updates an existing user's isAdmin status to true and sets their role to "admin" based on the email provided in the environment variable SUPER_ADMIN_EMAIL.

// To run this script, use the command: node scripts/seedAdmin.js
// Run this in the terminal: npm run seed:admin
// Before running, ensure you have the following:
// Make sure you have Node.js and Prisma set up in your project.
// Ensure you have set SUPER_ADMIN_EMAIL in your .env file
// Example .env entry: SUPER_ADMIN_EMAIL=admin@example.com
// This script will promote the specified user to Super Admin status
// and set their role to "admin" in the database.
// Make sure the user with that email already exists in the database.
// Handle errors gracefully and provide informative console output.
// After running, check the database to confirm the changes.
