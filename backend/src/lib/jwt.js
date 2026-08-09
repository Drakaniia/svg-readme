const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "svg-readme-dev-secret";
const JWT_EXPIRES_IN = "7d";

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { JWT_SECRET, JWT_EXPIRES_IN, signToken, verifyToken };
