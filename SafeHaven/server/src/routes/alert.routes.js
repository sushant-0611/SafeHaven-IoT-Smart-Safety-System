const express = require("express");

const router = express.Router();

const {
  getAlerts,
  syncAlerts,
  updateAlertStatus,
  getAlertSummary,
} = require("../controllers/alertController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

/*
 * GET all persistent alerts.
 *
 * Example:
 * GET /api/alerts/SAFEHAVEN-001
 */
router.get(
  "/:deviceId",
  authenticate,
  getAlerts
);

/*
 * GET alert summary.
 */
router.get(
  "/:deviceId/summary",
  authenticate,
  getAlertSummary
);

/*
 * Force telemetry -> alert synchronisation.
 */
router.post(
  "/:deviceId/sync",
  authenticate,
  syncAlerts
);

/*
 * Acknowledge / Resolve.
 */
router.patch(
  "/:alertId/status",
  authenticate,
  updateAlertStatus
);

module.exports = router;