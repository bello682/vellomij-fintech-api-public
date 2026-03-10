// cleanup.js is use to reset the database for testing whenever i want to register new users without conflicts. only for developement stage

// 1. FIRST: Load the credentials from .env
require("dotenv").config();

// 2. SECOND: Now that the credentials are loaded, import Prisma
// Import your EXISTING prisma client from your config folder
const prisma = require("./confiq/prismaClient");

async function main() {
  const WIPE_EVERYTHING = false; // to wipe the entire use change to true
  const ADMIN_EMAIL = "belloadetayo14@gmail.com"; // Updated to match your email with '14'

  try {
    if (WIPE_EVERYTHING) {
      console.log("🚀 Resetting ENTIRE database...");
      const tablenames = [
        "Transaction",
        "Kyc",
        "BankInfo",
        "Notification",
        "SupportTicket",
        "User",
      ];
      for (const table of tablenames) {
        // Using TRUNCATE with CASCADE is the only way to ignore the RESTRICT rules for a full wipe
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      }
      console.log("✨ Database wiped completely clean!");
    } else {
      console.log(`🛡️ Cleaning all users EXCEPT: ${ADMIN_EMAIL}...`);

      // STEP 1: Wipe ALL Transactions
      // We must do this because Transactions are "Restricted".
      // If any transaction exists for a user, Prisma cannot delete that user.
      await prisma.transaction.deleteMany({});
      console.log(
        "🗑️ All transaction history cleared (required to unlock user deletion).",
      );

      // STEP 2: Wipe ALL Notifications and Tickets (Optional but cleaner)
      await prisma.notification.deleteMany({
        where: { NOT: { user: { email: ADMIN_EMAIL } } },
      });
      await prisma.supportTicket.deleteMany({
        where: { NOT: { user: { email: ADMIN_EMAIL } } },
      });

      // STEP 3: Delete all users except Admin
      // This will now work because the Transactions are gone.
      // This will also cascade delete their Kyc and BankInfo records.
      const deleted = await prisma.user.deleteMany({
        where: {
          NOT: { email: ADMIN_EMAIL },
        },
      });

      console.log(`✅ Cleaned up ${deleted.count} test users.`);
      console.log(`✨ ${ADMIN_EMAIL} is now the only user in the system.`);
    }
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});

//   to run this script, use the command:
//   node cleanup.js

// run this to clean the user from the database
// node cleanup.js

// run this to seed when you wan to make a user become admin and to verify a user kyc for now
//  npm run seed:admin
