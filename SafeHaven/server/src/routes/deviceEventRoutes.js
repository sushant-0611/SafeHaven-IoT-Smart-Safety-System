const express = require("express");

const {
  getDeviceEvents,
  getDeviceEventById,
  createDeviceEvent,
} = require("../controllers/deviceEventController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();


// ------------------------------------
// Get device events
// ------------------------------------

router.get(
  "/",
  authenticate,
  getDeviceEvents
);


// ------------------------------------
// Get single event
// ------------------------------------

router.get(
  "/:id",
  authenticate,
  getDeviceEventById
);


// ------------------------------------
// Create device event
// ------------------------------------

router.post(
  "/",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  createDeviceEvent
);


module.exports = router;