const Activity = require("../models/Activity");

// ============================================================
// HELPER - NORMALIZE DEVICE ID
// ============================================================

function normalizeDeviceId(deviceId) {
  return String(deviceId || "")
    .trim()
    .toUpperCase();
}

// ============================================================
// POST /api/activity
// CREATE ACTIVITY
// Requires normal JWT authentication
// ============================================================

async function createActivity(req, res) {
  try {
    const {
      deviceId,
      type,
      action,
      title,
      description,
      status,
      commandId,
      mode,
      source,
      metadata,
      timestamp,
    } = req.body;

    // --------------------------------------------------------
    // Validate device
    // --------------------------------------------------------

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    // --------------------------------------------------------
    // Validate type
    // --------------------------------------------------------

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "type is required",
      });
    }

    // --------------------------------------------------------
    // Validate action
    // --------------------------------------------------------

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "action is required",
      });
    }

    // --------------------------------------------------------
    // Validate title
    // --------------------------------------------------------

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required",
      });
    }

    const normalizedDeviceId =
      normalizeDeviceId(deviceId);

    // --------------------------------------------------------
    // CREATE ACTIVITY
    // --------------------------------------------------------

    const activity = await Activity.create({
      deviceId: normalizedDeviceId,

      userId:
        req.user?._id ||
        req.user?.id ||
        null,

      type,
      action,
      title,

      description:
        description || "",

      status:
        status || "INFO",

      commandId:
        commandId || null,

      mode:
        mode || null,

      source:
        source || "SYSTEM",

      metadata:
        metadata || {},

      timestamp:
        timestamp
          ? new Date(timestamp)
          : new Date(),
    });

    console.log("=================================");
    console.log("[ACTIVITY SAVED]");
    console.log("Activity ID :", activity._id);
    console.log("Device      :", activity.deviceId);
    console.log("Type        :", activity.type);
    console.log("Action      :", activity.action);
    console.log("Title       :", activity.title);
    console.log("Mode        :", activity.mode);
    console.log("Source      :", activity.source);
    console.log("Status      :", activity.status);
    console.log("=================================");

    return res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: activity,
    });
  } catch (error) {
    console.error(
      "Create activity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create activity",
      error: error.message,
    });
  }
}

// ============================================================
// GET /api/activity/:deviceId
// GET DEVICE ACTIVITY
// Requires normal JWT authentication
// ============================================================

async function getDeviceActivity(req, res) {
  try {
    const deviceId =
      normalizeDeviceId(req.params.deviceId);

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || 20,
        1
      ),
      500
    );

    const activities =
      await Activity.find({
        deviceId,
      })
        .sort({
          timestamp: -1,
        })
        .limit(limit)
        .lean();

    return res.json({
      success: true,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    console.error(
      "Get device activity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activities",
      error: error.message,
    });
  }
}

// ============================================================
// PATCH /api/activity/:activityId
// UPDATE ACTIVITY
// Requires normal JWT authentication
// ============================================================

async function updateActivityStatus(req, res) {
  try {
    const { activityId } = req.params;

    const {
      status,
      description,
      metadata,
    } = req.body;

    if (!activityId) {
      return res.status(400).json({
        success: false,
        message: "activityId is required",
      });
    }

    const allowedStatuses = [
      "PENDING",
      "SUCCESS",
      "FAILED",
      "INFO",
    ];

    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid activity status",
      });
    }

    const updateFields = {};

    if (status) {
      updateFields.status = status;
    }

    if (
      description !== undefined
    ) {
      updateFields.description =
        description;
    }

    if (
      metadata !== undefined
    ) {
      updateFields.metadata =
        metadata;
    }

    const activity =
      await Activity.findByIdAndUpdate(
        activityId,
        {
          $set: updateFields,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    console.log("=================================");
    console.log("[ACTIVITY UPDATED]");
    console.log("Activity ID :", activity._id);
    console.log("Status      :", activity.status);
    console.log("=================================");

    return res.json({
      success: true,
      message: "Activity updated successfully",
      data: activity,
    });
  } catch (error) {
    console.error(
      "Update activity error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update activity",
      error: error.message,
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createActivity,
  getDeviceActivity,
  updateActivityStatus,
};