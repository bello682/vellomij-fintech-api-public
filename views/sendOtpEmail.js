const nodemailer = require("nodemailer");

// Email sending utility using Nodemailer
const sendOTPEmail = async (email, otp, fullName) => {
	const transporter = nodemailer.createTransport({
		service: "gmail", // Or any other email service you're using
		auth: {
			user: process.env.EMAIL_USER, // Your email
			pass: process.env.EMAIL_PASS, // Your email password
		},
	});

	const mailOptions = {
		from: process.env.EMAIL_USER,
		to: email,
		subject: "Your Verification OTP",
		html: `
			<!DOCTYPE html>
			<html lang="en">
			<head>
			  <meta charset="UTF-8" />
			  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
			  <style>
				@keyframes fadeIn {
				  from { opacity: 0; transform: translateY(-10px); }
				  to { opacity: 1; transform: translateY(0); }
				}

				.email-wrapper {
				  font-family: Arial, sans-serif;
				  background: #f4f4f4;
				  padding: 20px;
				  color: #333;
				  animation: fadeIn 0.8s ease-in-out;
				}

				.email-container {
				  max-width: 500px;
				  margin: auto;
				  background: #ffffff;
				  border-radius: 10px;
				  padding: 30px;
				  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
				}

				h2 {
				  color: #2c3e50;
				}

				.otp-box {
				  margin: 20px 0;
				  background-color: #4CAF50;
				  color: white;
				  font-size: 24px;
				  padding: 15px;
				  border-radius: 8px;
				  text-align: center;
				  letter-spacing: 3px;
				  font-weight: bold;
				}

				p {
				  font-size: 16px;
				  line-height: 1.5;
				}

				.footer {
				  margin-top: 30px;
				  font-size: 12px;
				  color: #aaa;
				  text-align: center;
				}
			  </style>
			</head>
			<body>
			  <div class="email-wrapper">
				<div class="email-container">
				  <h2>Hello ${fullName || "User"},</h2>
				  <p>Your OTP for account verification is:</p>

				  <div class="otp-box">
					${otp}
				  </div>

				  <p>This OTP is valid for 5 minutes.</p>
				  <p>Thank you for using our service!</p>

				  <div class="footer">
					&copy; ${new Date().getFullYear()} YourAppName. All rights reserved.
				  </div>
				</div>
			  </div>
			</body>
			</html>
		`,
		// text: `Your OTP for account verification is ${otp}. It will expire in 5 minutes.`,
	};

	await transporter.sendMail(mailOptions);
};

module.exports = sendOTPEmail;
