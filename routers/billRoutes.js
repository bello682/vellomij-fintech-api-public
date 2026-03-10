const express = require("express");
const router = express.Router();
const { buyAirtime, buyElectricity } = require("../controllers/billController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/buy-airtime", authMiddleware, buyAirtime);
router.post("/buy-electricity", authMiddleware, buyElectricity);

module.exports = router;
