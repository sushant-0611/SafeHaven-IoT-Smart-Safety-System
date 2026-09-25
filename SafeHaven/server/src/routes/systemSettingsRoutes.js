const express = require("express");

const {
  getSystemSettings,
  updateSystemSettings,
} = require("../controllers/systemSettingsController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

/* =========================================================
   GET SETTINGS
   ========================================================= */

router.get(
  "/",
  authenticate,
  getSystemSettings
);

/* =========================================================
   UPDATE SETTINGS
   ========================================================= */

router.put(
  "/",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateSystemSettings
);

module.exports = router;