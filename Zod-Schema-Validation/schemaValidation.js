// validators/userValidator.js
const { z } = require("zod");

const registrationSchema = z.object({
	fullName: z.string().min(3, "Full name must be at least 3 characters"),
	email: z.string().email("Please provide a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters long"),
});

const loginSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(1, "Password is required"),
});

const kycSchema = z.object({
	documentType: z.enum(["passport", "driverLicense", "idCard"]),
	occupation: z.string().min(2, "Occupation is too short"),
	address: z.string().min(5, "Address is too short"),
	dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), {
		message: "Invalid date format",
	}),
	placeOfWork: z.string().min(2, "Place of work is required"),
	bvn: z.string().length(11, "BVN must be exactly 11 digits"),
	phoneNumber: z.string().min(10, "Phone number is too short"),
});

const airtimeSchema = z.object({
	phoneNumber: z.string().min(10, "Invalid phone number"),
	amount: z.coerce.number().positive("Amount must be greater than zero"),
	network: z.enum(["MTN", "GLO", "AIRTEL", "9MOBILE"], {
		errorMap: () => ({ message: "Please select a valid network" }),
	}),
	pin: z.string().length(4, "PIN must be 4 digits"),
});

const electricitySchema = z.object({
	meterNumber: z.string().min(5, "Invalid meter number"),
	amount: z.coerce.number().positive(),
	provider: z.string().min(2, "Provider is required"),
	pin: z.string().length(4, "PIN must be 4 digits"),
});

// Exporting them so the controller can see them
module.exports = {
	registrationSchema,
	loginSchema,
	kycSchema,
	airtimeSchema,
	electricitySchema,
};
