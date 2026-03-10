// We will simulate a "VTU" (Virtual Top Up) service.

const prisma = require("../confiq/prismaClient");
const createNotification = require("../utils/notificationHelper");
const HttpError = require("../models/errorModel");
const bcrypt = require("bcryptjs");
const {
	airtimeSchema,
	electricitySchema,
} = require("../Zod-Schema-Validation/schemaValidation");

const buyAirtime = async (req, res, next) => {
	// 1. VALIDATION: This handles the string-to-number conversion!
	const validatedData = airtimeSchema.parse(req.body);
	const { phoneNumber, amount: rawAmount, network, pin } = validatedData;
	const amount = parseFloat(rawAmount); // <--- Add this conversion
	const userId = req.user.id || req.user.userId;

	try {
		// 1. SINGLE FETCH: Get User, Balance, and Frozen status
		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { bankInfo: true },
		});

		if (!user) return next(new HttpError("User not found.", 404));

		// 2. SECURITY CHECK: Is account frozen?
		if (user.isFrozen) {
			return next(
				new HttpError("Transaction failed. Your account is frozen.", 403)
			);
		}

		// 3. PIN & BALANCE CHECK
		const isPinValid = await bcrypt.compare(String(pin), user.transactionPin);
		if (!isPinValid)
			return next(new HttpError("Invalid Transaction PIN.", 401));

		if (user.bankInfo.balance < amount) {
			return next(new HttpError("Insufficient funds.", 400));
		}

		// 4. ATOMIC OPERATION
		const result = await prisma.$transaction(async (tx) => {
			const updatedWallet = await tx.bankInfo.update({
				where: { userId },
				data: { balance: { decrement: amount } },
			});

			const transaction = await tx.transaction.create({
				data: {
					amount,
					senderId: userId,
					type: "AIRTIME",
					category: "Utilities",
					status: "COMPLETED",
					description: `Airtime purchase for ${phoneNumber} (${network})`,
				},
			});

			return { balance: updatedWallet.balance, txId: transaction.id };
		});

		// 5. NOTIFICATION
		await createNotification(
			userId,
			"Airtime Purchase Successful",
			`You successfully topped up ${phoneNumber} with NGN ${amount}.`,
			"BILL_PAYMENT"
		);

		res.status(200).json({
			success: true,
			message: "Airtime sent successfully!",
			data: result,
		});
	} catch (err) {
		next(new HttpError(err.message || "Failed to process airtime.", 500));
	}
};

const buyElectricity = async (req, res, next) => {
	// 1. VALIDATION - This handles string-to-number conversion
	const validatedData = electricitySchema.parse(req.body);
	const { meterNumber, amount: rawAmount, provider, pin } = validatedData;
	const amount = parseFloat(rawAmount); // <--- Convert to number
	const userId = req.user.id || req.user.userId;

	try {
		// 1. SINGLE FETCH
		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { bankInfo: true },
		});

		// 2. SECURITY CHECKS
		if (!user) return next(new HttpError("User not found.", 404));
		if (user.isFrozen) return next(new HttpError("Account is frozen.", 403));

		const isPinValid = await bcrypt.compare(String(pin), user.transactionPin);
		if (!isPinValid) return next(new HttpError("Invalid PIN.", 401));

		if (user.bankInfo.balance < amount)
			return next(new HttpError("Insufficient balance.", 400));

		// 3. GENERATE TOKEN (Simulated)
		const token = Array.from({ length: 4 }, () =>
			Math.floor(1000 + Math.random() * 9000)
		).join("-");

		// 4. TRANSACTION
		const transactionResult = await prisma.$transaction(async (tx) => {
			await tx.bankInfo.update({
				where: { userId },
				data: { balance: { decrement: amount } },
			});

			return await tx.transaction.create({
				data: {
					amount,
					senderId: userId,
					type: "ELECTRICITY",
					category: "Power",
					status: "COMPLETED",
					description: `Electricity token for Meter: ${meterNumber} (${provider})`,
				},
			});
		});

		// 5. NOTIFICATION
		await createNotification(
			userId,
			"Electricity Purchase",
			`Token: ${token} for Meter ${meterNumber}. Amount: NGN ${amount}`,
			"BILL_PAYMENT"
		);

		res.status(200).json({
			success: true,
			message: "Purchase successful",
			data: { token, transactionId: transactionResult.id, amount },
		});
	} catch (err) {
		next(new HttpError(err.message || "Electricity purchase failed.", 500));
	}
};

module.exports = { buyAirtime, buyElectricity };
