id="5u2k8p"
const express = require("express");

const {
  receiveTelemetry,
  getLatestTelemetry,
  getTelemetryHistory,
} = require("../controllers/telemetryController");

const {
  getDevices,
  getDeviceById,
  getDeviceStatus,
} = require("../controllers/deviceController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const {
  authenticateDevice,
} = require("../middleware/deviceAuthMiddleware");

const router = express.Router();

// ============================================================
// DEVICE AUTHENTICATION TEST
//
// ESP32/device endpoint
// Requires device credentials.
// ============================================================

router.get(
  "/auth-test",
  authenticateDevice,
  (req, res) => {
    res.json({
      success: true,

      message:
        "Device authentication successful",

      device: {
        deviceId:
          req.device.deviceId,

        name:
          req.device.name,

        status:
          req.device.status,
      },
    });
  }
);

// ============================================================
// TELEMETRY
//
// ESP32/device endpoint
// Requires device authentication.
// ============================================================

router.post(
  "/telemetry",
  authenticateDevice,
  receiveTelemetry
);

// ============================================================
// DEVICE LIST
//
// Dashboard endpoint
// Requires SafeHaven user authentication.
// ============================================================

router.get(
  "/",
  authenticate,
  getDevices
);

// ============================================================
// DEVICE STATUS
//
// Dashboard endpoint
// IMPORTANT:
// This must come before /:deviceId
// ============================================================

router.get(
  "/:deviceId/status",
  authenticate,
  getDeviceStatus
);

// ============================================================
// DEVICE DETAILS
//
// Dashboard endpoint
// ============================================================

router.get(
  "/:deviceId",
  authenticate,
  getDeviceById
);

// ============================================================
// LATEST TELEMETRY
//
// Dashboard endpoint
// ============================================================

router.get(
  "/:deviceId/latest",
  authenticate,
  getLatestTelemetry
);

// ============================================================
// TELEMETRY HISTORY
//
// Dashboard endpoint
// ============================================================

router.get(
  "/:deviceId/history",
  authenticate,
  getTelemetryHistory
);

module.exports = router;