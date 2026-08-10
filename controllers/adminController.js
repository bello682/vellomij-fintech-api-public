const HttpError = require("../models/errorModel");
const prisma = require("../confiq/prismaClient");
const createNotification = require("../utils/notificationHelper");

const toggleUserFreeze = async (req, res, next) => {
  const { userId } = req.params;

  try {
    // 1. Find the user
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return next(new HttpError("User not found.", 404));
    }

    // 2. Toggle the boolean (if true, make false; if false, make true)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isFrozen: !user.isFrozen },
    });

    res.status(200).json({
      success: true,
      message: `User status updated. Account is now ${
        updatedUser.isFrozen ? "FROZEN" : "ACTIVE"
      }.`,
      isFrozen: updatedUser.isFrozen,
    });
  } catch (err) {
    next(new HttpError("Could not update user status.", 500));
  }
};

const updateUserLimit = async (req, res, next) => {
  const { userId } = req.params;
  const { newLimit } = req.body;

  try {
    if (newLimit < 0) {
      return next(new HttpError("Limit cannot be negative.", 400));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { dailyTransferLimit: parseFloat(newLimit) },
    });

    res.status(200).json({
      success: true,
      message: `User's daily limit has been updated to ${newLimit}.`,
    });
  } catch (err) {
    next(new HttpError("Could not update limit.", 500));
  }
};

const searchUser = async (req, res, next) => {
  const { query, page = 1 } = req.query;
  const limit = 10;
  const skip = (parseInt(page) - 1) * limit;

  if (!query) return next(new HttpError("Please provide a search term.", 400));

  try {
    // 1. Validate if the query is a valid UUID before searching the 'id' field
    const isUuid =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        query,
      );

    // 2. Build the search criteria dynamically
    const searchCriteria = {
      OR: [
        ...(isUuid ? [{ id: query }] : []), // Spread the ID check ONLY if it's a UUID
        { fullName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        {
          bankInfo: {
            accountNumber: { contains: query },
          },
        },
      ],
    };

    // 3. Get total count for pagination math
    const totalCount = await prisma.user.count({ where: searchCriteria });

    // 4. Fetch the specific page of results
    const users = await prisma.user.findMany({
      where: searchCriteria,
      skip: skip,
      take: limit,
      select: {
        id: true,
        fullName: true,
        email: true,
        isFrozen: true,
        createdAt: true,
        bankInfo: {
          select: {
            accountNumber: true,
            balance: true,
          },
        },
        kyc: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page),
        limit,
      },
      data: users,
    });
  } catch (err) {
    // Log the error for the dev, but send a clean message to the admin
    console.error("Search Error:", err);
    next(new HttpError("Search failed. Please try a different term.", 500));
  }
};

// Get Admin Dashboard Stats
const getAdminStats = async (req, res, next) => {
  try {
    // 1. Get Start of Today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 2. Run all queries in parallel for speed
    const [totalUsers, totalBalance, volumeToday] = await Promise.all([
      // Count total users
      prisma.user.count(),

      // Sum up all money in the system (Liquidity)
      prisma.bankInfo.aggregate({
        _sum: { balance: true },
      }),

      // Total volume of successful transfers today
      prisma.transaction.aggregate({
        where: {
          type: "TRANSFER",
          status: "COMPLETED",
          createdAt: { gte: startOfToday },
        },
        _sum: { amount: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        platformUsers: totalUsers,
        totalSystemLiquidity: totalBalance._sum.balance || 0,
        transactionVolumeToday: volumeToday._sum.amount || 0,
        currency: "NGN",
      },
    });
  } catch (err) {
    next(new HttpError("Could not fetch dashboard stats.", 500));
  }
};

// Get Pending KYC Requests
const getPendingKYCs = async (req, res, next) => {
  try {
    const pendingList = await prisma.kyc.findMany({
      where: { status: "PENDING" },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first (First come, first served)
    });

    res.status(200).json({
      success: true,
      count: pendingList.length,
      data: pendingList,
    });
  } catch (err) {
    next(new HttpError("Could not fetch pending KYCs.", 500));
  }
};

// Update KYC Status by Admin (Approve or Reject)
const updateKycStatus = async (req, res, next) => {
  const { kycId, status, reason } = req.body; // status: "VERIFIED" or "REJECTED"

  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return next(new HttpError("Invalid status update.", 400));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update the KYC record
      const updatedKyc = await tx.kyc.update({
        where: { id: kycId },
        data: {
          status: status,
          rejectionReason: status === "REJECTED" ? reason : null,
        },
      });

      // 2. Send Notification to User
      const title =
        status === "VERIFIED" ? "KYC Approved! 🎉" : "KYC Rejected ⚠️";
      const message =
        status === "VERIFIED"
          ? "Your identity has been verified. You can now perform full transfers."
          : `Your KYC was rejected. Reason: ${
              reason || "Invalid documents"
            }. Please try again.`;

      await createNotification(updatedKyc.userId, title, message, "SYSTEM");

      return updatedKyc;
    });

    res.status(200).json({
      success: true,
      message: `KYC has been ${status.toLowerCase()} successfully.`,
      data: result,
    });
  } catch (err) {
    next(new HttpError("Failed to update KYC status.", 500));
  }
};

// this is just to create and make a user admin manually
const makeUserAdmin = async (req, res, next) => {
  const { email } = req.body;

  try {
    // 1. Check if user exists first
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return next(new HttpError("User with this email not found.", 404));
    }

    // 2. Perform update: Add verification_status here
    await prisma.user.update({
      where: { email },
      data: {
        isAdmin: true,
        role: "admin",
        verification_status: "verified", // <--- Added this line to verify user for noe
      },
    });

    res.status(200).json({
      success: true,
      message: `${email} has been promoted to Admin and KYC verified successfully.`,
    });
  } catch (err) {
    next(new HttpError("Failed to promote user.", 500));
  }
};

module.exports = {
  toggleUserFreeze,
  updateUserLimit,
  makeUserAdmin,
  searchUser,
  getAdminStats,
  updateKycStatus,
  getPendingKYCs,
};
