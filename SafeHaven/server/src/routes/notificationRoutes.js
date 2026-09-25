const express = require("express");

const {
  getNotificationLogs,
  getUnreadNotificationCount,
  getNotificationLogById,
  createNotificationLog,
  updateNotificationStatus,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationLogController");

const {
  checkSMSDecision,
  createSMSNotification,
} = require("../controllers/smsController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ------------------------------------
// Get notification history
// GET /api/notifications
// ------------------------------------

router.get(
  "/",
  authenticate,
  getNotificationLogs
);

// ------------------------------------
// Get unread notification count
// GET /api/notifications/unread-count
// ------------------------------------

router.get(
  "/unread-count",
  authenticate,
  getUnreadNotificationCount
);

// ------------------------------------
// Mark all notifications as read
// PATCH /api/notifications/read-all
// ------------------------------------

router.patch(
  "/read-all",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  markAllNotificationsAsRead
);

// ------------------------------------
// Check SMS decision
// POST /api/notifications/sms/decision
// ------------------------------------

router.post(
  "/sms/decision",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  checkSMSDecision
);

// ------------------------------------
// Create SMS notification
// POST /api/notifications/sms/send
// ------------------------------------

router.post(
  "/sms/send",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  createSMSNotification
);

// ------------------------------------
// Create notification log
// POST /api/notifications
// ------------------------------------

router.post(
  "/",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  createNotificationLog
);

// ------------------------------------
// Update notification status
// PATCH /api/notifications/:id/status
// ------------------------------------

router.patch(
  "/:id/status",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  updateNotificationStatus
);

// ------------------------------------
// Mark one notification as read
// PATCH /api/notifications/:id/read
// ------------------------------------

router.patch(
  "/:id/read",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATOR"
  ),
  markNotificationAsRead
);

// ------------------------------------
// Get one notification
// GET /api/notifications/:id
// ------------------------------------

router.get(
  "/:id",
  authenticate,
  getNotificationLogById
);

module.exports = router;