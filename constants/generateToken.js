const jwt = require("jsonwebtoken");

// Add a second parameter 'expiresIn' with a default value of "1h"
const generateToken = (user, expiresIn = "1h") => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      role: user.role,
    },
    process.env.JSON_WEB_TOKEN_SECRET_KEY,
    { expiresIn }, // Use the dynamic value
  );
};

module.exports = generateToken;
