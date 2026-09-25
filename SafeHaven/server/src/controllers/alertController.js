const Alert = require("../models/Alert");
const Telemetry = require("../models/Telemetry");
const mongoose = require("mongoose");

const DEVICE_ID = "SAFEHAVEN-001";

const THRESHOLDS = {
  temperature: {
    warning: 40,
    danger: 45,
  },

  humidity: {
    warning: 60,
    danger: 80,
  },

  smoke: {
    warning: 40,
    danger: 70,
  },

  gas: {
    warning: 40,
    danger: 70,
  },

  noise: {
    warning: 50,
    danger: 80,
  },

  fire: {
    warning: 50,
    danger: 70,
  },
};

const SENSOR_CONFIG = {
  temperature: {
    title: "High Temperature Detected",
    source: "DHT11 Temperature Sensor",
    unit: "°C",
    message:
      "Temperature has crossed the configured safety threshold.",
  },

  humidity: {
    title: "High Humidity Detected",
    source: "DHT11 Humidity Sensor",
    unit: "%",
    message:
      "Humidity has crossed the configured safety threshold.",
  },

  smoke: {
    title: "Smoke Level Detected",
    source: "MQ-2 Smoke Sensor",
    unit: "%",
    message:
      "Smoke concentration has crossed the configured threshold.",
  },

  gas: {
    title: "Gas Level Detected",
    source: "MQ-6 Gas Sensor",
    unit: "%",
    message:
      "Gas concentration has crossed the configured threshold.",
  },

  noise: {
    title: "High Noise Level",
    source: "Sound Sensor",
    unit: "dB",
    message:
      "Noise level is above the configured safety limit.",
  },

  fire: {
    title: "Fire Sensor Triggered",
    source: "Flame Sensor",
    unit: "%",
    message:
      "The flame sensor has detected a possible fire condition.",
  },
};

function normalizeDeviceId(value) {
  return String(value || DEVICE_ID)
    .trim()
    .toUpperCase();
}

function getSeverity(value, threshold) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (numericValue >= threshold.danger) {
    return "DANGER";
  }

  if (numericValue >= threshold.warning) {
    return "WARNING";
  }

  return null;
}

function getUserId(req) {
  return req.user?._id || req.user?.id || null;
}

/**
 * Convert one telemetry record into possible alerts.
 */
function getTelemetryAlerts(record) {
  const deviceId = normalizeDeviceId(record.deviceId);

  const timestamp =
    record.timestamp ||
    record.createdAt ||
    new Date();

  const recordId = String(
    record._id ||
      record.id ||
      `${deviceId}-${new Date(timestamp).getTime()}`
  );

  const sensors = [
    "temperature",
    "humidity",
    "smoke",
    "gas",
    "noise",
    "fire",
  ];

  return sensors
    .map((sensor) => {
      const value = Number(record[sensor]);

      const severity = getSeverity(
        value,
        THRESHOLDS[sensor]
      );

      if (!severity) {
        return null;
      }

      const config = SENSOR_CONFIG[sensor];

      return {
        deviceId,
        sensor,
        severity,
        title: config.title,
        message: config.message,
        source: config.source,
        value,
        unit: config.unit,
        triggeredAt: new Date(timestamp),
        recordId,
      };
    })
    .filter(Boolean);
}

/**
 * Find an already open alert for a sensor.
 *
 * ACTIVE / ACKNOWLEDGED alerts are considered open.
 */
async function findOpenAlert(deviceId, sensor) {
  return Alert.findOne({
    deviceId,
    sensor,
    status: {
      $in: ["ACTIVE", "ACKNOWLEDGED"],
    },
  }).sort({
    triggeredAt: -1,
  });
}

/**
 * Sync telemetry into persistent alerts.
 *
 * Important:
 * We DO NOT create one alert for every telemetry reading.
 * If an alert for that sensor is already ACTIVE/ACKNOWLEDGED,
 * we update its latest value instead.
 */
async function syncTelemetryAlerts(deviceId) {
  const telemetry = await Telemetry.find({
    deviceId,
  })
    .sort({
      timestamp: -1,
    })
    .limit(500)
    .lean();

  if (!telemetry.length) {
    return [];
  }

  const newestBySensor = new Map();

  for (const record of telemetry) {
    const generated = getTelemetryAlerts(record);

    for (const alert of generated) {
      if (!newestBySensor.has(alert.sensor)) {
        newestBySensor.set(alert.sensor, alert);
      }
    }
  }

  const syncedAlerts = [];

  for (const alertData of newestBySensor.values()) {
    const existing = await findOpenAlert(
      deviceId,
      alertData.sensor
    );

    if (existing) {
      existing.severity = alertData.severity;
      existing.title = alertData.title;
      existing.message = alertData.message;
      existing.source = alertData.source;
      existing.value = alertData.value;
      existing.unit = alertData.unit;
      existing.lastSeenAt = alertData.triggeredAt;
      existing.lastValue = alertData.value;

      existing.metadata = {
        ...(existing.metadata || {}),
        latestSeverity: alertData.severity,
        latestValue: alertData.value,
        latestTelemetryAt:
          alertData.triggeredAt,
      };

      await existing.save();

      syncedAlerts.push(existing);

      continue;
    }

    /*
     * Do not recreate an alert continuously after the
     * user has resolved it while the same dangerous
     * telemetry is still present.
     *
     * We only create a new alert if there is no previous
     * alert with this recordId.
     */
    const existingOccurrence = await Alert.findOne({
      deviceId,
      sensor: alertData.sensor,
      recordId: alertData.recordId,
    });

    if (existingOccurrence) {
      syncedAlerts.push(existingOccurrence);
      continue;
    }

    const created = await Alert.create({
      ...alertData,

      status: "ACTIVE",

      lastSeenAt: alertData.triggeredAt,
      lastValue: alertData.value,

      metadata: {
        createdFrom: "TELEMETRY",
        threshold: THRESHOLDS[alertData.sensor],
      },
    });

    syncedAlerts.push(created);
  }

  return syncedAlerts;
}

/**
 * GET /api/alerts/:deviceId
 *
 * Returns persistent alerts from MongoDB.
 */
async function getAlerts(req, res) {
  try {
    const deviceId = normalizeDeviceId(
      req.params.deviceId
    );

    await syncTelemetryAlerts(deviceId);

    const requestedLimit = Number(
      req.query.limit || 500
    );

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      500
    );

    const status = String(
      req.query.status || "ALL"
    ).toUpperCase();

    const filter = {
      deviceId,
    };

    if (
      ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"].includes(
        status
      )
    ) {
      filter.status = status;
    }

    const alerts = await Alert.find(filter)
      .sort({
        triggeredAt: -1,
      })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      deviceId,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error(
      "getAlerts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load alerts.",
    });
  }
}

/**
 * POST /api/alerts/:deviceId/sync
 *
 * Manually synchronise latest telemetry.
 */
async function syncAlerts(req, res) {
  try {
    const deviceId = normalizeDeviceId(
      req.params.deviceId
    );

    const alerts =
      await syncTelemetryAlerts(deviceId);

    return res.json({
      success: true,
      deviceId,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error(
      "syncAlerts error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to synchronize alerts.",
    });
  }
}

/**
 * PATCH /api/alerts/:alertId/status
 *
 * ACTIVE -> ACKNOWLEDGED
 * ACTIVE -> RESOLVED
 * ACKNOWLEDGED -> RESOLVED
 */
const updateAlertStatus = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { status, resolutionNote } = req.body;

    console.log("\n========== UPDATE ALERT STATUS ==========");
    console.log("Alert ID:", alertId);
    console.log("Requested status:", status);
    console.log("Resolution note:", resolutionNote);
    console.log("User:", req.user);

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    const allowedStatuses = [
      "ACKNOWLEDGED",
      "RESOLVED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert status.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(alertId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid alert ID.",
      });
    }

    // --------------------------------------------------
    // FIND EXISTING ALERT
    // --------------------------------------------------

    const alert = await Alert.findById(alertId);

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: "Alert not found.",
      });
    }

    console.log("Existing alert found:");
    console.log({
      id: alert._id,
      deviceId: alert.deviceId,
      sensor: alert.sensor,
      source: alert.source,
      triggeredAt: alert.triggeredAt,
      currentStatus: alert.status,
    });

    // --------------------------------------------------
    // ALREADY RESOLVED
    // --------------------------------------------------

    if (alert.status === "RESOLVED") {
      return res.status(400).json({
        success: false,
        message: "Resolved alerts cannot be modified.",
      });
    }

    // --------------------------------------------------
    // USER ID
    // --------------------------------------------------

    const userId =
      req.user?._id ||
      req.user?.id ||
      null;

    // --------------------------------------------------
    // ACKNOWLEDGE
    // --------------------------------------------------

    if (status === "ACKNOWLEDGED") {
      if (alert.status === "ACKNOWLEDGED") {
        return res.status(200).json({
          success: true,
          message: "Alert is already acknowledged.",
          data: alert,
        });
      }

      if (alert.status !== "ACTIVE") {
        return res.status(400).json({
          success: false,
          message: `Cannot acknowledge alert with status ${alert.status}.`,
        });
      }

      alert.status = "ACKNOWLEDGED";
      alert.acknowledgedAt = new Date();

      if (userId) {
        alert.acknowledgedBy = userId;
      }

      alert.metadata = {
        ...(alert.metadata || {}),
        lastAction: "ACKNOWLEDGED",
        lastActionAt: new Date(),
      };

      // IMPORTANT:
      // Save the EXISTING alert.
      // Do NOT use new Alert() here.
      await alert.save();

      console.log("Alert acknowledged successfully:", alert._id);

      // Socket update
      const io = req.app.get("io");

      if (io) {
        io.to(`device:${alert.deviceId}`).emit(
          "alert:update",
          alert
        );
      }

      return res.status(200).json({
        success: true,
        message: "Alert acknowledged successfully.",
        data: alert,
      });
    }

    // --------------------------------------------------
    // RESOLVE
    // --------------------------------------------------

    if (status === "RESOLVED") {
      if (
        alert.status !== "ACTIVE" &&
        alert.status !== "ACKNOWLEDGED"
      ) {
        return res.status(400).json({
          success: false,
          message: `Cannot resolve alert with status ${alert.status}.`,
        });
      }

      alert.status = "RESOLVED";
      alert.resolvedAt = new Date();

      if (userId) {
        alert.resolvedBy = userId;
      }

      if (
        typeof resolutionNote === "string" &&
        resolutionNote.trim()
      ) {
        alert.resolutionNote = resolutionNote.trim();
      }

      alert.metadata = {
        ...(alert.metadata || {}),
        lastAction: "RESOLVED",
        lastActionAt: new Date(),
      };

      // IMPORTANT:
      // Save the EXISTING alert.
      await alert.save();

      console.log("Alert resolved successfully:", alert._id);

      // Socket update
      const io = req.app.get("io");

      if (io) {
        io.to(`device:${alert.deviceId}`).emit(
          "alert:update",
          alert
        );
      }

      return res.status(200).json({
        success: true,
        message: "Alert resolved successfully.",
        data: alert,
      });
    }

  } catch (error) {
    console.error("\n========== UPDATE ALERT STATUS ERROR ==========");
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    return res.status(500).json({
      success: false,
      message: error.message || "Unable to update alert status.",
    });
  }
};

/**
 * GET /api/alerts/:deviceId/summary
 */
async function getAlertSummary(req, res) {
  try {
    const deviceId = normalizeDeviceId(
      req.params.deviceId
    );

    await syncTelemetryAlerts(deviceId);

    const [
      activeCount,
      acknowledgedCount,
      resolvedCount,
      dangerCount,
      warningCount,
    ] = await Promise.all([
      Alert.countDocuments({
        deviceId,
        status: "ACTIVE",
      }),

      Alert.countDocuments({
        deviceId,
        status: "ACKNOWLEDGED",
      }),

      Alert.countDocuments({
        deviceId,
        status: "RESOLVED",
      }),

      Alert.countDocuments({
        deviceId,
        severity: "DANGER",
        status: {
          $ne: "RESOLVED",
        },
      }),

      Alert.countDocuments({
        deviceId,
        severity: "WARNING",
        status: {
          $ne: "RESOLVED",
        },
      }),
    ]);

    return res.json({
      success: true,
      deviceId,
      data: {
        active: activeCount,
        acknowledged: acknowledgedCount,
        resolved: resolvedCount,
        danger: dangerCount,
        warning: warningCount,
      },
    });
  } catch (error) {
    console.error(
      "getAlertSummary error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load alert summary.",
    });
  }
}

module.exports = {
  getAlerts,
  syncAlerts,
  updateAlertStatus,
  getAlertSummary,
};