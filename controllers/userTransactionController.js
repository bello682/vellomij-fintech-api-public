const prisma = require("../confiq/prismaClient");
const HttpError = require("../models/errorModel");
const createNotification = require("../utils/notificationHelper");
const bcrypt = require("bcryptjs");
const axios = require("axios");

// --- TRANSACTION CONTROLLER ---

// 1. SEND MONEY (Internal Transfer)
// 1. P2P TRANSFER (User to User)

const transferMoney = async (req, res, next) => {
  const senderId = req.user.id || req.user.userId;
  const { receiverAccountNumber, amount, pin, currency, description } =
    req.body;

  try {
    // 1. Fetch User & Basic Security
    const user = await prisma.user.findUnique({ where: { id: senderId } });
    if (!user) return next(new HttpError("User not found.", 404));

    if (user.isFrozen)
      return next(new HttpError("Account frozen. Contact support.", 403));
    if (!user.transactionPin)
      return next(new HttpError("Please set a transaction PIN.", 400));

    const isPinValid = await bcrypt.compare(String(pin), user.transactionPin);
    if (!isPinValid)
      return next(new HttpError("Incorrect Transaction PIN.", 401));

    // 2. Daily Limit Check
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const totalSentToday = await prisma.transaction.aggregate({
      where: {
        senderId,
        createdAt: { gte: startOfToday },
        status: "COMPLETED",
        type: "TRANSFER",
      },
      _sum: { amount: true },
    });

    const currentSpent = totalSentToday._sum.amount || 0;
    if (currentSpent + amount > user.dailyTransferLimit) {
      return next(
        new HttpError(
          `Limit exceeded. Remaining: ${
            user.dailyTransferLimit - currentSpent
          } NGN`,
          400,
        ),
      );
    }

    // 3. KYC Check
    const userKyc = await prisma.kyc.findUnique({
      where: { userId: senderId },
    });
    if (!userKyc) return next(new HttpError("KYC verification required.", 403));

    // 4. Atomic Transaction
    const result = await prisma.$transaction(async (tx) => {
      const senderBankInfo = await tx.bankInfo.findUnique({
        where: { userId: senderId },
      });
      const receiverBankInfo = await tx.bankInfo.findUnique({
        where: { accountNumber: String(receiverAccountNumber) },
        include: { user: true }, // <--- CRITICAL: We need the user record for the name
      });

      if (!senderBankInfo) throw new Error("Sender bank info not found.");
      if (!receiverBankInfo)
        throw new Error("Receiver account does not exist.");
      if (senderBankInfo.balance < amount)
        throw new Error("Insufficient funds.");
      if (senderBankInfo.accountNumber === String(receiverAccountNumber))
        throw new Error("Cannot transfer to self.");

      // Update Balances
      const updatedSender = await tx.bankInfo.update({
        where: { userId: senderId },
        data: { balance: { decrement: amount } },
      });

      await tx.bankInfo.update({
        where: { userId: receiverBankInfo.userId },
        data: { balance: { increment: amount } },
      });

      // Log Transaction Snapshot
      const transactionRecord = await tx.transaction.create({
        data: {
          amount,
          currency: currency || "NGN",
          type: "TRANSFER",
          status: "COMPLETED",
          description:
            description || `Transfer to ${receiverBankInfo.user.fullName}`,
          senderId: senderId,
          receiverId: receiverBankInfo.userId,

          // These fields are why you must run the migration
          senderName: user.fullName,
          senderAccount: senderBankInfo.accountNumber,
          senderBank: senderBankInfo.bankName || "Vellomij Bank",

          recipientName: receiverBankInfo.user.fullName,
          recipientAccount: receiverBankInfo.accountNumber,
          recipientBank: receiverBankInfo.bankName || "Vellomij Bank",
        },
      });

      return {
        transactionId: transactionRecord.id,
        newBalance: updatedSender.balance,
        recipientName: transactionRecord.recipientName,
        receiverId: transactionRecord.receiverId,
      };
    });

    // 5. Notifications
    await createNotification(
      senderId,
      "Debit Alert",
      `Sent ${amount} to ${result.recipientName}`,
      "DEBIT",
    );
    await createNotification(
      result.receiverId,
      "Credit Alert",
      `Received ${amount} from ${user.fullName}`,
      "CREDIT",
    );

    res
      .status(200)
      .json({ status: true, message: "Transfer successful", data: result });
  } catch (err) {
    next(new HttpError(err.message, 400));
  }
};

// 2. GET TRANSACTION HISTORY (For the "Receive" and "Send" view)
const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    const {
      page = 1,
      search = "",
      type,
      category,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page);
    const limit = 20;
    const skip = (pageNum - 1) * limit;

    // 1. Build whereClause
    const whereClause = {
      AND: [
        { OR: [{ senderId: userId }, { receiverId: userId }] },
        {
          OR: [
            { description: { contains: search, mode: "insensitive" } },
            { senderName: { contains: search, mode: "insensitive" } },
            { recipientName: { contains: search, mode: "insensitive" } },
          ],
        },
      ],
    };

    if (type) whereClause.AND.push({ type });
    if (category) whereClause.AND.push({ category });
    if (startDate && endDate) {
      whereClause.AND.push({
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      });
    }

    const totalCount = await prisma.transaction.count({ where: whereClause });

    const history = await prisma.transaction.findMany({
      where: whereClause,
      take: limit,
      skip: skip,
      orderBy: { createdAt: "desc" },
      // Notice: We don't need to 'include' User or BankInfo anymore!
      // The data is already inside the Transaction record (Snapshots).
    });

    // 2. Full Mapping for the Frontend
    const formattedHistory = history.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      date: tx.createdAt,
      status: tx.status,
      category: tx.category,
      transactionType: tx.type,
      flowType: tx.senderId === userId ? "DEBIT" : "CREDIT",

      // --- THE CRITICAL FIX: Use Snapshots ---
      senderName: tx.senderName,
      senderBank: tx.senderBank,
      senderAccount: tx.senderAccount,
      recipientName: tx.recipientName,
      recipientBank: tx.recipientBank,
      recipientAccount: tx.recipientAccount,

      // For the main list view (Summary)
      participant:
        tx.senderId === userId
          ? tx.recipientName || "Service Provider"
          : tx.senderName || "Unknown Sender",
      account:
        tx.senderId === userId
          ? tx.recipientAccount || "N/A"
          : tx.senderAccount || "N/A",
    }));

    res.status(200).json({
      success: true,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: pageNum,
        limit: limit,
      },
      data: formattedHistory,
    });
  } catch (err) {
    next(new HttpError(err.message, 500));
  }
};

const verifyAccountNumber = async (req, res, next) => {
  // 1. Production standard expects bankCode (058 for GTB, your_app_code for internal)
  const { accountNumber, bankCode } = req.body;

  try {
    if (!accountNumber || !bankCode) {
      return next(
        new HttpError("Account number and Bank Code are required.", 400),
      );
    }

    const cleanAccount = String(accountNumber).trim();

    // 2. INTERNAL CHECK (If the bank code belongs to YOUR bank)
    if (bankCode === "VELLOMIJ_CODE") {
      // Replace with your actual bank code
      const bankInfo = await prisma.bankInfo.findUnique({
        where: { accountNumber: cleanAccount },
        include: { user: { select: { fullName: true } } },
      });

      if (!bankInfo)
        return next(new HttpError("Internal account not found.", 404));

      return res.status(200).json({
        success: true,
        accountName: bankInfo.user?.fullName || bankInfo.accountHolderName,
        isInternal: true,
      });
    }

    //  delete later for testing sake i am using my account Number and name
    if (cleanAccount === "8139056805") {
      return res.status(200).json({
        success: true,
        accountName: "BELLO ADETAYO OLAMIJI", // Put your name here!
        isInternal: false,
      });
    }
    //  delete later for testing sake i am using my account Number and name

    // 3. EXTERNAL CHECK (Paystack API)
    const paystackResponse = await axios.get(
      `https://api.paystack.co/bank/resolve?account_number=${cleanAccount}&bank_code=${bankCode}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      },
    );

    return res.status(200).json({
      success: true,
      accountName: paystackResponse.data.data.account_name,
      isInternal: false,
    });
  } catch (err) {
    // Handle Paystack errors specifically (e.g. invalid account)
    const message = err.response?.data?.message || "Verification failed";
    next(new HttpError(message, 400));
  }
};

const getTransactionReceipt = async (req, res, next) => {
  const { transactionId } = req.params;
  const userId = req.user.userId || req.user.id;

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: {
          select: {
            fullName: true,
            bankInfo: { select: { accountNumber: true } },
          },
        },
        receiver: {
          select: {
            fullName: true,
            bankInfo: { select: { accountNumber: true } },
          },
        },
      },
    });

    if (!transaction) {
      return next(new HttpError("Transaction not found.", 404));
    }

    // Security check: Only the sender or receiver can view the receipt
    if (transaction.senderId !== userId && transaction.receiverId !== userId) {
      return next(new HttpError("Unauthorized to view this receipt.", 403));
    }

    // Format data for a clean receipt UI
    const receipt = {
      receiptNo: transaction.id.split("-")[0].toUpperCase(), // Short ID for display
      transactionDate: transaction.createdAt,
      amount: transaction.amount,
      currency: transaction.currency,
      status: transaction.status,
      type: transaction.senderId === userId ? "DEBIT" : "CREDIT",
      description: transaction.description,
      sender: {
        name: transaction.sender.fullName,
        account: transaction.sender.bankInfo?.accountNumber,
      },
      // The improved receiver logic handles both Users and Bill Payments
      receiver: {
        name: transaction.receiver?.fullName || "Service Provider",
        account: transaction.receiver?.bankInfo?.accountNumber || "N/A",
      },
      reference: `FT-${Date.now()}`, // Simulated bank reference
    };

    res.status(200).json({
      success: true,
      data: receipt,
    });
  } catch (err) {
    next(new HttpError("Could not generate receipt.", 500));
  }
};

// 2. FUND WALLET (Deposit)
const fundWallet = async (req, res, next) => {
  try {
    const { amount, currency } = req.body;
    const userId = req.user.id || req.user.userId;

    // 2. Robust conversion: Handle strings, numbers, and commas
    const numericAmount = Number(String(amount).replace(/[^0-9.]/g, ""));

    // 3. Validation
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      return next(
        new HttpError(
          "Please provide a valid numeric amount greater than zero",
          400,
        ),
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update the user's balance
      const updatedBank = await tx.bankInfo.update({
        where: { userId: userId },
        data: { balance: { increment: numericAmount } },
      });

      // Log the DEPOSIT
      const log = await tx.transaction.create({
        data: {
          amount: numericAmount,
          currency: currency || "NGN",
          type: "DEPOSIT",
          category: "Deposit",
          status: "COMPLETED",
          description: "Wallet Funding",
          senderId: userId,
          receiverId: userId,
        },
      });

      return { newBalance: updatedBank.balance, transactionId: log.id };
    });

    res.status(200).json({
      status: "success",
      message: "Wallet funded successfully",
      data: result,
    });
  } catch (err) {
    console.error("Fund Wallet Error:", err.message);
    next(new HttpError(err.message, 500));
  }
};

module.exports = {
  transferMoney,
  verifyAccountNumber,
  getTransactionHistory,

  fundWallet,
  getTransactionReceipt,
};
