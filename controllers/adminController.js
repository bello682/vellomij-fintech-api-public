const HttpError = require("../models/errorModel");
const prisma = require("../confiq/prismaClient");
const createNotification = require("../utils/notificationHelper");

// ── USER MANAGEMENT ───────────────────────────────────────────────

const toggleUserFreeze = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return next(new HttpError("User not found.", 404));

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isFrozen: !user.isFrozen },
    });

    // Notify the user
    await createNotification(
      userId,
      updatedUser.isFrozen ? "Account Frozen" : "Account Restored",
      updatedUser.isFrozen
        ? "Your account has been temporarily frozen by an administrator. Contact support if you believe this is an error."
        : "Your account has been restored and is now fully active.",
      "SYSTEM",
    );

    res.status(200).json({
      success: true,
      message: `Account is now ${updatedUser.isFrozen ? "FROZEN" : "ACTIVE"}.`,
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
    if (newLimit === undefined || newLimit === null) {
      return next(new HttpError("New limit is required.", 400));
    }
    if (parseFloat(newLimit) < 0) {
      return next(new HttpError("Limit cannot be negative.", 400));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { dailyTransferLimit: parseFloat(newLimit) },
    });

    res.status(200).json({
      success: true,
      message: `Daily limit updated to ₦${Number(newLimit).toLocaleString()}.`,
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
    const isUuid =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        query,
      );

    const searchCriteria = {
      OR: [
        ...(isUuid ? [{ id: query }] : []),
        { fullName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { bankInfo: { accountNumber: { contains: query } } },
      ],
    };

    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where: searchCriteria }),
      prisma.user.findMany({
        where: searchCriteria,
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          isFrozen: true,
          // isAdmin: true,
          verification_status: true,
          dailyTransferLimit: true,
          createdAt: true,
          bankInfo: {
            select: { accountNumber: true, balance: true },
          },
          kyc: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

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
    console.error("Search Error:", err);
    next(new HttpError("Search failed. Please try a different term.", 500));
  }
};

// ── DASHBOARD ─────────────────────────────────────────────────────

const getAdminStats = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalBalance,
      volumeToday,
      pendingKycCount,
      openTickets,
    ] = await Promise.all([
      prisma.user.count({ where: { isDeleted: false } }),

      prisma.bankInfo.aggregate({ _sum: { balance: true } }),

      prisma.transaction.aggregate({
        where: {
          type: "TRANSFER",
          status: "COMPLETED",
          createdAt: { gte: startOfToday },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      prisma.kyc.count({ where: { status: "PENDING" } }),

      prisma.supportTicket.count({ where: { status: "OPEN" } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        platformUsers: totalUsers,
        totalSystemLiquidity: totalBalance._sum.balance || 0,
        transactionVolumeToday: volumeToday._sum.amount || 0,
        transactionCountToday: volumeToday._count.id || 0,
        pendingKyc: pendingKycCount,
        openTickets,
        currency: "NGN",
      },
    });
  } catch (err) {
    next(new HttpError("Could not fetch dashboard stats.", 500));
  }
};

// ── KYC ───────────────────────────────────────────────────────────

const getPendingKYCs = async (req, res, next) => {
  try {
    const pendingList = await prisma.kyc.findMany({
      where: { status: "PENDING" },
      include: {
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
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

const updateKycStatus = async (req, res, next) => {
  const { kycId, status, reason } = req.body;

  if (!kycId) return next(new HttpError("KYC ID is required.", 400));
  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return next(new HttpError("Status must be VERIFIED or REJECTED.", 400));
  }
  if (status === "REJECTED" && !reason?.trim()) {
    return next(new HttpError("A rejection reason is required.", 400));
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update KYC record
      const updatedKyc = await tx.kyc.update({
        where: { id: kycId },
        data: {
          status,
          verified: status === "VERIFIED",
          rejectionReason: status === "REJECTED" ? reason : null,
        },
      });

      // 2. If approved, also update user verification status
      if (status === "VERIFIED") {
        await tx.user.update({
          where: { id: updatedKyc.userId },
          data: {
            verification_status: "verified",
            isVerified: true,
          },
        });
      } else {
        await tx.user.update({
          where: { id: updatedKyc.userId },
          data: { verification_status: "rejected" },
        });
      }

      // 3. Notify user
      const title =
        status === "VERIFIED" ? "KYC Approved! 🎉" : "KYC Rejected ⚠️";
      const message =
        status === "VERIFIED"
          ? "Your identity has been verified. You can now perform full transfers."
          : `Your KYC was rejected. Reason: ${reason || "Invalid documents"}. Please re-upload valid documents.`;

      await createNotification(updatedKyc.userId, title, message, "KYC");

      return updatedKyc;
    });

    res.status(200).json({
      success: true,
      message: `KYC has been ${status === "VERIFIED" ? "approved" : "rejected"} successfully.`,
      data: result,
    });
  } catch (err) {
    console.error("KYC Update Error:", err);
    next(new HttpError("Failed to update KYC status.", 500));
  }
};

// ── TRANSACTIONS (Admin view) ─────────────────────────────────────

const getAllTransactions = async (req, res, next) => {
  const {
    page = 1,
    limit = 15,
    type,
    status,
    dateFrom,
    dateTo,
    query,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Build dynamic where clause
    const where = {};

    if (type) where.type = type;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Search by reference, sender name, or recipient name
    if (query) {
      where.OR = [
        { id: { contains: query, mode: "insensitive" } },
        { senderName: { contains: query, mode: "insensitive" } },
        { recipientName: { contains: query, mode: "insensitive" } },
        { senderAccount: { contains: query } },
        { recipientAccount: { contains: query } },
      ];
    }

    const [totalCount, transactions] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          type: true,
          status: true,
          description: true,
          senderName: true,
          senderBank: true,
          senderAccount: true,
          recipientName: true,
          recipientBank: true,
          recipientAccount: true,
          createdAt: true,
          sender: { select: { id: true, fullName: true, email: true } },
          receiver: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
      data: transactions,
    });
  } catch (err) {
    console.error("Transaction fetch error:", err);
    next(new HttpError("Could not fetch transactions.", 500));
  }
};

const getTransactionById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, fullName: true, email: true } },
        receiver: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!transaction) return next(new HttpError("Transaction not found.", 404));

    res.status(200).json({ success: true, data: transaction });
  } catch (err) {
    next(new HttpError("Could not fetch transaction.", 500));
  }
};

// ── SUPPORT TICKETS (Admin view) ──────────────────────────────────

const getAllTickets = async (req, res, next) => {
  const { page = 1, status, priority } = req.query;
  const limit = 15;
  const skip = (parseInt(page) - 1) * limit;

  try {
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [totalCount, tickets] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: parseInt(page),
        limit,
      },
      data: tickets,
    });
  } catch (err) {
    next(new HttpError("Could not fetch support tickets.", 500));
  }
};

const replyToTicket = async (req, res, next) => {
  const { ticketId } = req.params;
  const { message } = req.body;

  if (!message?.trim()) {
    return next(new HttpError("Reply message is required.", 400));
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) return next(new HttpError("Ticket not found.", 404));

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        adminReply: message,
        status: "PENDING", // Mark as pending admin reply sent, awaiting user
      },
    });

    // Notify user of reply
    await createNotification(
      ticket.userId,
      "Support Reply Received",
      `An admin has replied to your ticket: "${ticket.subject}". Please check your support hub.`,
      "SYSTEM",
    );

    res.status(200).json({
      success: true,
      message: "Reply sent successfully.",
      data: updated,
    });
  } catch (err) {
    next(new HttpError("Could not send reply.", 500));
  }
};

const updateTicketStatus = async (req, res, next) => {
  const { ticketId } = req.params;
  const { status } = req.body;

  const validStatuses = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];
  if (!validStatuses.includes(status)) {
    return next(
      new HttpError(`Status must be one of: ${validStatuses.join(", ")}`, 400),
    );
  }

  try {
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });

    res.status(200).json({
      success: true,
      message: `Ticket marked as ${status}.`,
      data: updated,
    });
  } catch (err) {
    next(new HttpError("Could not update ticket status.", 500));
  }
};

module.exports = {
  // User
  toggleUserFreeze,
  updateUserLimit,

  searchUser,
  // Dashboard
  getAdminStats,
  // KYC
  getPendingKYCs,
  updateKycStatus,
  // Transactions
  getAllTransactions,
  getTransactionById,
  // Support
  getAllTickets,
  replyToTicket,
  updateTicketStatus,
};
