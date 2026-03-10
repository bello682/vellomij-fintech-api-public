const prisma = require("../confiq/prismaClient");

const createNotification = async (userId, title, message, type) => {
	try {
		await prisma.notification.create({
			data: { userId, title, message, type },
		});
	} catch (error) {
		console.error("Notification Error:", error);
	}
};

module.exports = createNotification;
