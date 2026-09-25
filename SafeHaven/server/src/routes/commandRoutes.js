const express = require("express");

const {
  createCommand,
  getPendingCommands,
  markCommandSent,
  updateCommandResult,
  getCommandHistory,
} = require("../controllers/commandController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

const {
  authenticateDevice,
} = require("../middleware/deviceAuthMiddleware");

const router = express.Router();

// ============================================================
// USER / ADMIN COMMAND CREATION
// Requires normal JWT authentication
// ============================================================

router.post(
  "/",
  authenticate,
  createCommand
);

// ============================================================
// ESP32 COMMAND POLLING
// Requires device authentication
// ============================================================

router.get(
  "/:deviceId/pending",
  authenticateDevice,
  getPendingCommands
);

// ============================================================
// ESP32 CONFIRMS COMMAND RECEIVED
// Requires device authentication
// ============================================================

router.patch(
  "/:commandId/sent",
  authenticateDevice,
  markCommandSent
);

// ============================================================
// ESP32 REPORTS COMMAND EXECUTION RESULT
// Requires device authentication
// ============================================================

router.patch(
  "/:commandId/result",
  authenticateDevice,
  updateCommandResult
);

// ============================================================
// USER / ADMIN COMMAND HISTORY
// Requires normal JWT authentication
// ============================================================

router.get(
  "/:deviceId/history",
  authenticate,
  getCommandHistory
);

module.exports = router;