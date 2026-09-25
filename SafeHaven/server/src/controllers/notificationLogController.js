const NotificationLog = require("../models/NotificationLog");

const {
  emitNotificationUpdate,
  emitDashboardRefresh,
} = require("../services/socketService");

// ------------------------------------
// GET /api/notifications
// Notification history with filters
// and pagination
// ------------------------------------

async function getNotificationLogs(req, res) {
  try {
    const {
      deviceId,
      type,
      status,
      isRead,
      page,
      limit,
    } = req.query;

    const query = {};

    // ------------------------------------
    // Device filter
    // ------------------------------------

    if (deviceId) {
      query.deviceId = String(deviceId)
        .trim()
        .toUpperCase();
    }

    // ------------------------------------
    // Type filter
    // ------------------------------------

    if (type) {
      const normalizedType = String(type)
        .trim()
        .toUpperCase();

      const allowedTypes = [
        "SMS",
        "BROWSER",
        "SYSTEM",
      ];

      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            "Type must be SMS, BROWSER or SYSTEM",
        });
      }

      query.type = normalizedType;
    }

    // ------------------------------------
    // Status filter
    // ------------------------------------

    if (status) {
      const normalizedStatus = String(status)
        .trim()
        .toUpperCase();

      const allowedStatuses = [
        "PENDING",
        "SENT",
        "FAILED",
      ];

      if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be PENDING, SENT or FAILED",
        });
      }

      query.status = normalizedStatus;
    }

    // ------------------------------------
    // Read / unread filter
    // ------------------------------------

    if (typeof isRead !== "undefined") {
      const normalizedIsRead = String(isRead)
        .trim()
        .toLowerCase();

      if (
        normalizedIsRead !== "true" &&
        normalizedIsRead !== "false"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "isRead must be true or false",
        });
      }

      query.isRead =
        normalizedIsRead === "true";
    }

    // ------------------------------------
    // Pagination
    // ------------------------------------

    const parsedPage = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const parsedLimit = Math.min(
      Math.max(
        parseInt(limit, 10) || 50,
        1
      ),
      500
    );

    const skip =
      (parsedPage - 1) * parsedLimit;

    // ------------------------------------
    // Count total records
    // ------------------------------------

    const total =
      await NotificationLog.countDocuments(
        query
      );

    const totalPages =
      Math.ceil(total / parsedLimit);

    // ------------------------------------
    // Fetch notifications
    // ------------------------------------

    const logs =
      await NotificationLog.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(parsedLimit)
        .lean();

    return res.json({
      success: true,
      count: logs.length,

      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,

        hasNextPage:
          parsedPage < totalPages,

        hasPreviousPage:
          parsedPage > 1,
      },

      filters: {
        deviceId: deviceId
          ? String(deviceId)
              .trim()
              .toUpperCase()
          : null,

        type: type
          ? String(type)
              .trim()
              .toUpperCase()
          : null,

        status: status
          ? String(status)
              .trim()
              .toUpperCase()
          : null,

        isRead:
          typeof isRead !== "undefined"
            ? String(isRead)
                .trim()
                .toLowerCase() === "true"
            : null,
      },

      data: logs,
    });
  } catch (error) {
    console.error(
      "Get notification logs error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch notification logs",
      error: error.message,
    });
  }
}

// ------------------------------------
// GET /api/notifications/unread-count
// ------------------------------------

async function getUnreadNotificationCount(
  req,
  res
) {
  try {
    const {
      deviceId,
      type,
    } = req.query;

    const query = {
      isRead: false,
    };

    // ------------------------------------
    // Optional device filter
    // ------------------------------------

    if (deviceId) {
      query.deviceId = String(deviceId)
        .trim()
        .toUpperCase();
    }

    // ------------------------------------
    // Optional type filter
    // ------------------------------------

    if (type) {
      const normalizedType = String(type)
        .trim()
        .toUpperCase();

      const allowedTypes = [
        "SMS",
        "BROWSER",
        "SYSTEM",
      ];

      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            "Type must be SMS, BROWSER or SYSTEM",
        });
      }

      query.type = normalizedType;
    }

    const count =
      await NotificationLog.countDocuments(
        query
      );

    return res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error(
      "Get unread notification count error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch unread notification count",
      error: error.message,
    });
  }
}

// ------------------------------------
// GET /api/notifications/:id
// ------------------------------------

async function getNotificationLogById(
  req,
  res
) {
  try {
    const log =
      await NotificationLog.findById(
        req.params.id
      ).lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message:
          "Notification log not found",
      });
    }

    return res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error(
      "Get notification log error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch notification log",
      error: error.message,
    });
  }
}

// ------------------------------------
// POST /api/notifications
// ------------------------------------

async function createNotificationLog(
  req,
  res
) {
  try {
    const {
      deviceId,
      type,
      recipient,
      message,
      status,
      alertId,
      errorMessage,
      sentAt,
      isRead,
    } = req.body || {};

    // ------------------------------------
    // Required fields
    // ------------------------------------

    if (!type) {
      return res.status(400).json({
        success: false,
        message:
          "Notification type is required",
      });
    }

    if (!recipient) {
      return res.status(400).json({
        success: false,
        message:
          "Recipient is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message:
          "Message is required",
      });
    }

    // ------------------------------------
    // Validate type
    // ------------------------------------

    const normalizedType = String(type)
      .trim()
      .toUpperCase();

    const allowedTypes = [
      "SMS",
      "BROWSER",
      "SYSTEM",
    ];

    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid notification type",
      });
    }

    // ------------------------------------
    // Validate status
    // ------------------------------------

    let normalizedStatus = "PENDING";

    if (status) {
      normalizedStatus = String(status)
        .trim()
        .toUpperCase();

      const allowedStatuses = [
        "PENDING",
        "SENT",
        "FAILED",
      ];

      if (
        !allowedStatuses.includes(
          normalizedStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be PENDING, SENT or FAILED",
        });
      }
    }

    // ------------------------------------
    // Validate isRead
    // ------------------------------------

    let normalizedIsRead = false;

    if (typeof isRead !== "undefined") {
      if (typeof isRead !== "boolean") {
        return res.status(400).json({
          success: false,
          message:
            "isRead must be a boolean",
        });
      }

      normalizedIsRead = isRead;
    }

    // ------------------------------------
    // Normalize device ID
    // ------------------------------------

    const normalizedDeviceId = deviceId
      ? String(deviceId)
          .trim()
          .toUpperCase()
      : null;

    // ------------------------------------
    // Create notification
    // ------------------------------------

    const log =
      await NotificationLog.create({
        deviceId:
          normalizedDeviceId,

        type:
          normalizedType,

        recipient:
          String(recipient).trim(),

        message:
          String(message).trim(),

        status:
          normalizedStatus,

        alertId:
          alertId || null,

        errorMessage:
          errorMessage || null,

        commandId:
          null,

        isRead:
          normalizedIsRead,

        sentAt:
          sentAt
            ? new Date(sentAt)
            : null,
      });

    // ------------------------------------
    // REALTIME EVENT
    // ------------------------------------

    emitNotificationUpdate({
      deviceId:
        normalizedDeviceId,

      notification:
        log,

      action:
        "CREATED",
    });

    emitDashboardRefresh({
      reason:
        "NOTIFICATION_CREATED",

      deviceId:
        normalizedDeviceId,
    });

    return res.status(201).json({
      success: true,
      message:
        "Notification log created successfully",
      data: log,
    });
  } catch (error) {
    console.error(
      "Create notification log error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create notification log",
      error: error.message,
    });
  }
}

// ------------------------------------
// PATCH /api/notifications/:id/status
// ------------------------------------

async function updateNotificationStatus(
  req,
  res
) {
  try {
    const {
      status,
      errorMessage,
    } = req.body || {};

    const normalizedStatus =
      status
        ? String(status)
            .trim()
            .toUpperCase()
        : "";

    const allowedStatuses = [
      "PENDING",
      "SENT",
      "FAILED",
    ];

    if (
      !allowedStatuses.includes(
        normalizedStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status must be PENDING, SENT or FAILED",
      });
    }

    const update = {
      status:
        normalizedStatus,
    };

    if (normalizedStatus === "SENT") {
      update.sentAt = new Date();
      update.errorMessage = null;
    }

    if (normalizedStatus === "FAILED") {
      update.errorMessage =
        errorMessage ||
        "Notification sending failed";
    }

    if (normalizedStatus === "PENDING") {
      update.sentAt = null;
      update.errorMessage = null;
    }

    const log =
      await NotificationLog.findByIdAndUpdate(
        req.params.id,
        {
          $set: update,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!log) {
      return res.status(404).json({
        success: false,
        message:
          "Notification log not found",
      });
    }

    // ------------------------------------
    // REALTIME EVENT
    // ------------------------------------

    const normalizedDeviceId =
      log.deviceId
        ? String(log.deviceId)
            .trim()
            .toUpperCase()
        : null;

    emitNotificationUpdate({
      deviceId:
        normalizedDeviceId,

      notification:
        log,

      action:
        "STATUS_UPDATED",
    });

    emitDashboardRefresh({
      reason:
        "NOTIFICATION_STATUS_UPDATED",

      deviceId:
        normalizedDeviceId,
    });

    return res.json({
      success: true,
      message:
        "Notification status updated",
      data: log,
    });
  } catch (error) {
    console.error(
      "Update notification status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update notification status",
      error: error.message,
    });
  }
}

// ------------------------------------
// PATCH /api/notifications/:id/read
// ------------------------------------

async function markNotificationAsRead(
  req,
  res
) {
  try {
    const log =
      await NotificationLog.findByIdAndUpdate(
        req.params.id,
        {
          $set: {
            isRead: true,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!log) {
      return res.status(404).json({
        success: false,
        message:
          "Notification log not found",
      });
    }

    // ------------------------------------
    // REALTIME EVENT
    // ------------------------------------

    const normalizedDeviceId =
      log.deviceId
        ? String(log.deviceId)
            .trim()
            .toUpperCase()
        : null;

    emitNotificationUpdate({
      deviceId:
        normalizedDeviceId,

      notification:
        log,

      action:
        "READ",
    });

    emitDashboardRefresh({
      reason:
        "NOTIFICATION_READ",

      deviceId:
        normalizedDeviceId,
    });

    return res.json({
      success: true,
      message:
        "Notification marked as read",
      data: log,
    });
  } catch (error) {
    console.error(
      "Mark notification as read error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark notification as read",
      error: error.message,
    });
  }
}

// ------------------------------------
// PATCH /api/notifications/read-all
// ------------------------------------

async function markAllNotificationsAsRead(
  req,
  res
) {
  try {
    // req.body can be undefined when PATCH
    // is called without a request body.

    const {
      deviceId,
      type,
    } = req.body || {};

    // ------------------------------------
    // Base query
    // ------------------------------------

    const query = {
      isRead: false,
    };

    // ------------------------------------
    // Optional device filter
    // ------------------------------------

    const normalizedDeviceId = deviceId
      ? String(deviceId)
          .trim()
          .toUpperCase()
      : null;

    if (normalizedDeviceId) {
      query.deviceId =
        normalizedDeviceId;
    }

    // ------------------------------------
    // Optional type filter
    // ------------------------------------

    let normalizedType = null;

    if (type) {
      normalizedType = String(type)
        .trim()
        .toUpperCase();

      const allowedTypes = [
        "SMS",
        "BROWSER",
        "SYSTEM",
      ];

      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message:
            "Type must be SMS, BROWSER or SYSTEM",
        });
      }

      query.type =
        normalizedType;
    }

    // ------------------------------------
    // Update all matching unread records
    // ------------------------------------

    const result =
      await NotificationLog.updateMany(
        query,
        {
          $set: {
            isRead: true,
          },
        }
      );

    // ------------------------------------
    // REALTIME EVENT
    // ------------------------------------
    //
    // updateMany does not return all
    // modified documents, so we send
    // summary information.
    // ------------------------------------

    emitNotificationUpdate({
      deviceId:
        normalizedDeviceId,

      notification: {
        matchedCount:
          result.matchedCount,

        modifiedCount:
          result.modifiedCount,

        type:
          normalizedType,
      },

      action:
        "READ_ALL",
    });

    emitDashboardRefresh({
      reason:
        "NOTIFICATIONS_READ_ALL",

      deviceId:
        normalizedDeviceId,
    });

    return res.json({
      success: true,
      message:
        "All notifications marked as read",

      data: {
        matchedCount:
          result.matchedCount,

        modifiedCount:
          result.modifiedCount,
      },
    });
  } catch (error) {
    console.error(
      "Mark all notifications as read error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to mark notifications as read",
      error: error.message,
    });
  }
}

// ------------------------------------
// EXPORT
// ------------------------------------

module.exports = {
  getNotificationLogs,
  getUnreadNotificationCount,
  getNotificationLogById,
  createNotificationLog,
  updateNotificationStatus,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};