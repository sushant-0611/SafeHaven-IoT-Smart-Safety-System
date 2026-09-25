const express = require("express");

const router = express.Router();

const {
  createActivity,
  getDeviceActivity,
  updateActivityStatus,
} = require("../controllers/activityController");

const {
  authenticate,
} = require("../middleware/authMiddleware");

// ============================================================
// CREATE ACTIVITY
// POST /api/activity
// ============================================================

router.post(
  "/",
  authenticate,
  createActivity
);

// ============================================================
// GET DEVICE ACTIVITIES
// GET /api/activity/:deviceId
// ============================================================

router.get(
  "/:deviceId",
  authenticate,
  getDeviceActivity
);

// ============================================================
// UPDATE ACTIVITY
// PATCH /api/activity/:activityId
// ============================================================

router.patch(
  "/:activityId",
  authenticate,
  updateActivityStatus
);

module.exports = router;