const express = require("express");
const router = express.Router({ mergeParams: true });
const { getElements, saveElements } = require("../controllers/elementController");

router.get("/", getElements);
router.put("/", saveElements);

module.exports = router;
