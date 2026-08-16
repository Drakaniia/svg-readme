// Legacy convenience entry — the real server lives in src/ (with auth).
// Keeping this file as a forwarding shim so `node index.js` and
// `node src/index.js` behave identically.
require("dotenv").config();
const { start } = require("./src/index.js");
start();