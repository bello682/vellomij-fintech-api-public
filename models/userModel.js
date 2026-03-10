// models/userModel.js
const prisma = require('../confiq/prismaClient');

// We export the user "delegate". 
// Now, in your controllers, you can do: User.create(), User.findUnique(), etc.
const User = prisma.user;

module.exports = User;