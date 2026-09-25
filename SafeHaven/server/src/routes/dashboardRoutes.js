const express = require("express");

const {
  getDashboardStatistics,
} = require("../controllers/dashboardController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// DASHBOARD STATISTICS
// ============================================================

router.get(
  "/statistics",
  authenticate,
  getDashboardStatistics
);

module.exports = router;