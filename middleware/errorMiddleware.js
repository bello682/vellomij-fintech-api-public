const { ZodError } = require("zod");

// notFound error
const notFound = (req, res, next) => {
  const error = new Error(`Page Not Found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (error, req, res, next) => {
  if (res.headerSent) {
    return next(error);
  }

  // 1. Determine the status code
  // Use the error's code/status, or default to 400 for Zod, or 500 for everything else
  let statusCode = error.statusCode || error.code || 500;
  if (error instanceof ZodError) statusCode = 400;

  // 2. Determine the message
  let message = error.message || "An unexpected error occurred";

  // 3. Handle Zod Errors (The "Ugly" JSON)
  if (error instanceof ZodError) {
    // This turns the "Ugly" list into: "bvn: message, email: message"
    message = error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(" | ");
  }
  // 4. Handle cases where Zod error was already stringified before reaching here
  else if (typeof message === "string" && message.includes('"code":')) {
    try {
      const parsed = JSON.parse(message);
      if (Array.isArray(parsed)) {
        message = parsed.map((err) => err.message).join(" | ");
        statusCode = 400;
      }
    } catch (e) {
      // If parsing fails, just keep the original message
    }
  }

  // 5. Final clean response
  res.status(statusCode).json({
    success: false,
    message: message,
    status: statusCode,
  });
};
module.exports = { notFound, errorHandler };
