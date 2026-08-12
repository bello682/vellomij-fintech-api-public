const jwt = require("jsonwebtoken");

const generateAdminToken = (admin, expiresIn = "8h") => {
  return jwt.sign(
    {
      adminId: admin.id,
      email:   admin.email,
      role:    admin.role,
    },
    process.env.JSON_WEB_TOKEN_SECRET_KEY,
    { expiresIn },
  );
};

module.exports = generateAdminToken;
