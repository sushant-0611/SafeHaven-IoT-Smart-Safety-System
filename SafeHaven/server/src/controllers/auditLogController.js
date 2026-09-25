const AuditLog = require("../models/AuditLog");

// GET /api/audit-logs
async function getAuditLogs(req, res) {
  try {
    const {
      userId,
      deviceId,
      category,
      action,
      limit,
    } = req.query;

    const query = {};

    if (userId) {
      query.userId = userId;
    }

    if (deviceId) {
      query.deviceId = String(deviceId)
        .trim()
        .toUpperCase();
    }

    if (category) {
      query.category = String(category)
        .trim()
        .toUpperCase();
    }

    if (action) {
      query.action = String(action).trim();
    }

    const parsedLimit = Math.min(
      Math.max(
        parseInt(limit, 10) || 50,
        1
      ),
      500
    );

    const logs = await AuditLog.find(query)
      .populate(
        "userId",
        "name email role"
      )
      .sort({
        createdAt: -1,
      })
      .limit(parsedLimit)
      .lean();

    return res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error(
      "Get audit logs error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch audit logs",
    });
  }
}


// GET /api/audit-logs/:id
async function getAuditLogById(req, res) {
  try {
    const log =
      await AuditLog.findById(
        req.params.id
      )
        .populate(
          "userId",
          "name email role"
        )
        .lean();

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Audit log not found",
      });
    }

    return res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error(
      "Get audit log error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch audit log",
    });
  }
}


// POST /api/audit-logs
async function createAuditLog(req, res) {
  try {
    const {
      action,
      category,
      description,
      deviceId,
      metadata,
    } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: "action is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message:
          "description is required",
      });
    }

    const normalizedCategory =
      category
        ? String(category)
            .trim()
            .toUpperCase()
        : "SYSTEM";

    const allowedCategories = [
      "AUTH",
      "DEVICE",
      "COMMAND",
      "SETTINGS",
      "ALERT",
      "SYSTEM",
    ];

    if (
      !allowedCategories.includes(
        normalizedCategory
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid audit log category",
      });
    }

    const log = await AuditLog.create({
      userId: req.user?._id || null,

      deviceId: deviceId
        ? String(deviceId)
            .trim()
            .toUpperCase()
        : null,

      action: String(action).trim(),

      category:
        normalizedCategory,

      description,

      metadata:
        metadata || {},

      ipAddress:
        req.ip || null,
    });

    return res.status(201).json({
      success: true,
      message:
        "Audit log created successfully",
      data: log,
    });
  } catch (error) {
    console.error(
      "Create audit log error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create audit log",
      error: error.message,
    });
  }
}


module.exports = {
  getAuditLogs,
  getAuditLogById,
  createAuditLog,
};