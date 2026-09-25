const express = require("express");

const {
  getAuditLogs,
  getAuditLogById,
  createAuditLog,
} = require("../controllers/auditLogController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();


// ------------------------------------
// Get audit logs
// ------------------------------------

router.get(
  "/",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAuditLogs
);


// ------------------------------------
// Get single audit log
// ------------------------------------

router.get(
  "/:id",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  getAuditLogById
);


// ------------------------------------
// Create audit log
// ------------------------------------

router.post(
  "/",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  createAuditLog
);


module.exports = router;