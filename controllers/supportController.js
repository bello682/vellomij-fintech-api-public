const prisma = require("../confiq/prismaClient");
const HttpError = require("../models/errorModel");

const createTicket = async (req, res, next) => {
	const { subject, message, priority } = req.body;
	const userId = req.user.userId || req.user.id;

	try {
		const ticket = await prisma.supportTicket.create({
			data: {
				userId,
				subject,
				message,
				priority: priority || "MEDIUM",
			},
		});

		res.status(201).json({
			success: true,
			message:
				"Support ticket created successfully. Our team will get back to you.",
			ticket,
		});
	} catch (err) {
		console.log(err);
		next(new HttpError("Could not create ticket. Please try again.", 500));
	}
};

const getUserTickets = async (req, res, next) => {
	const userId = req.user.userId || req.user.id;
	try {
		const tickets = await prisma.supportTicket.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});
		res.status(200).json({ success: true, tickets });
	} catch (err) {
		next(new HttpError("Fetching tickets failed.", 500));
	}
};

// ADMIN: Get all tickets in the system
const getAllTickets = async (req, res, next) => {
	try {
		const tickets = await prisma.supportTicket.findMany({
			include: {
				user: { select: { fullName: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
		});
		res.status(200).json({ success: true, tickets });
	} catch (err) {
		next(new HttpError("Could not fetch tickets.", 500));
	}
};

// ADMIN: Reply to a ticket and change status
const resolveTicket = async (req, res, next) => {
	const { ticketId, adminReply, status } = req.body; // status could be RESOLVED or CLOSED

	try {
		const updatedTicket = await prisma.supportTicket.update({
			where: { id: ticketId },
			data: {
				adminReply,
				status: status || "RESOLVED",
			},
		});

		// Notify the user that their ticket has been updated
		await createNotification(
			updatedTicket.userId,
			"Support Update",
			`Your ticket regarding '${updatedTicket.subject}' has been updated: ${adminReply}`,
			"SYSTEM"
		);

		res.status(200).json({
			success: true,
			message: "Ticket updated and user notified.",
			updatedTicket,
		});
	} catch (err) {
		next(new HttpError("Failed to update ticket.", 500));
	}
};

module.exports = { createTicket, getUserTickets, getAllTickets, resolveTicket };
