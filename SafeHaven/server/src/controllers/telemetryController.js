const Device = require("../models/Device");
const Telemetry = require("../models/Telemetry");
const Alert = require("../models/Alert");

const {
  processAutomation,
} = require("../services/automationService");

const {
  evaluateSafetyStatus,
  getSafetyThresholds,
} = require("../services/safetyService");

const {
  markDeviceOnline,
} = require("../services/deviceStatusService");

// =====================================================
// SOCKET.IO REAL-TIME EVENTS
// =====================================================

const {
  emitTelemetryUpdate,
  emitDeviceStatusUpdate,
  emitAlertUpdate,
  emitDashboardRefresh,
} = require("../services/socketService");

// =====================================================
// HELPER
// Normalize Device ID
// =====================================================

function normalizeDeviceId(deviceId) {
  return String(deviceId || "")
    .trim()
    .toUpperCase();
}

// =====================================================
// HELPER
// Convert value to number safely
// =====================================================

function toNumberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

// =====================================================
// HELPER
// Convert value to boolean safely
// =====================================================

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value
      .trim()
      .toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return Boolean(value);
}

// =====================================================
// SENSOR CONFIGURATION
// =====================================================

const SENSOR_CONFIG = {
  temperature: {
    titleWarning: "High Temperature",
    titleDanger: "Dangerous Temperature",
    unit: "°C",
    warningMessage: (value) =>
      `Temperature has reached ${value}°C`,
    dangerMessage: (value) =>
      `Temperature has reached ${value}°C`,
  },

  humidity: {
    titleWarning: "High Humidity",
    titleDanger: "Very High Humidity",
    unit: "%",
    warningMessage: (value) =>
      `Humidity has reached ${value}%`,
    dangerMessage: (value) =>
      `Humidity has reached ${value}%`,
  },

  smoke: {
    titleWarning: "Smoke Detected",
    titleDanger: "High Smoke Level",
    unit: "%",
    warningMessage: (value) =>
      `Smoke level has reached ${value}%`,
    dangerMessage: (value) =>
      `Smoke level has reached ${value}%`,
  },

  gas: {
    titleWarning: "Gas Detected",
    titleDanger: "Dangerous Gas Level",
    unit: "%",
    warningMessage: (value) =>
      `Gas level has reached ${value}%`,
    dangerMessage: (value) =>
      `Gas level has reached ${value}%`,
  },

  noise: {
    titleWarning: "High Noise Level",
    titleDanger: "Dangerous Noise Level",
    unit: "Index",
    warningMessage: (value) =>
      `Noise index has reached ${value}`,
    dangerMessage: (value) =>
      `Noise index has reached ${value}`,
  },

  fire: {
    titleWarning: "Possible Fire Detected",
    titleDanger: "Fire Detected",
    unit: "%",
    warningMessage: (value) =>
      `Flame intensity has reached ${value}%`,
    dangerMessage: (value) =>
      `Flame intensity has reached ${value}%`,
  },
};

const SENSOR_NAMES = [
  "temperature",
  "humidity",
  "smoke",
  "gas",
  "noise",
  "fire",
];

// =====================================================
// BUILD ALERT DEFINITION
// =====================================================

function buildAlertDefinition(
  sensor,
  value,
  thresholds
) {
  if (value === null || value === undefined) {
    return null;
  }

  const config = SENSOR_CONFIG[sensor];
  const threshold = thresholds?.[sensor];

  if (!config || !threshold) {
    return null;
  }

  // -----------------------------------------------
  // DANGER
  // -----------------------------------------------

  if (value >= threshold.danger) {
    return {
      sensor,
      severity: "DANGER",
      title: config.titleDanger,
      message: config.dangerMessage(value),
      value,
      threshold: threshold.danger,
      unit: threshold.unit || config.unit,
    };
  }

  // -----------------------------------------------
  // WARNING
  // -----------------------------------------------

  if (value >= threshold.warning) {
    return {
      sensor,
      severity: "WARNING",
      title: config.titleWarning,
      message: config.warningMessage(value),
      value,
      threshold: threshold.warning,
      unit: threshold.unit || config.unit,
    };
  }

  return null;
}

// =====================================================
// CREATE / UPDATE / RESOLVE PERSISTENT ALERTS
// =====================================================

async function processTelemetryAlerts(
  telemetry,
  normalizedDeviceId,
  telemetryTimestamp,
  thresholds
) {
  const alertResults = [];

  const telemetryValues = {
    temperature: telemetry.temperature,
    humidity: telemetry.humidity,
    smoke: telemetry.smoke,
    gas: telemetry.gas,
    noise: telemetry.noise,
    fire: telemetry.fire,
  };

  // ===================================================
  // PROCESS EACH SENSOR
  // ===================================================

  for (const sensor of SENSOR_NAMES) {
    const value = telemetryValues[sensor];

    const alertDefinition = buildAlertDefinition(
      sensor,
      value,
      thresholds
    );

    // =================================================
    // SENSOR IS IN NORMAL RANGE
    // =================================================

    if (!alertDefinition) {
      try {
        const activeAlerts = await Alert.find({
          deviceId: normalizedDeviceId,
          sensor,
          status: {
            $in: ["ACTIVE", "ACKNOWLEDGED"],
          },
        });

        for (const alert of activeAlerts) {
          alert.status = "RESOLVED";
          alert.resolvedAt = new Date();
          alert.resolutionNote =
            "Sensor value returned to normal range.";
          alert.lastSeenAt =
            telemetryTimestamp;
          alert.lastValue = value;

          await alert.save();

          emitAlertUpdate({
            deviceId: normalizedDeviceId,
            action: "RESOLVED",
            alert: alert.toObject(),
          });

          alertResults.push({
            sensor,
            severity: alert.severity,
            created: false,
            duplicate: false,
            resolved: true,
            alertId: alert._id,
          });
        }
      } catch (error) {
        console.error(
          `Alert resolve error [${sensor}]:`,
          error
        );

        alertResults.push({
          sensor,
          created: false,
          duplicate: false,
          resolved: false,
          alertId: null,
          error: error.message,
        });
      }

      continue;
    }

    // =================================================
    // SENSOR HAS WARNING / DANGER CONDITION
    // =================================================

    try {
      let existingAlert = await Alert.findOne({
        deviceId: normalizedDeviceId,
        sensor,
        status: {
          $in: ["ACTIVE", "ACKNOWLEDGED"],
        },
      }).sort({
        triggeredAt: -1,
      });

      // ---------------------------------------------
      // EXISTING ACTIVE ALERT
      // ---------------------------------------------

      if (existingAlert) {
        existingAlert.lastSeenAt =
          telemetryTimestamp;

        existingAlert.lastValue =
          value;

        existingAlert.value =
          value;

        existingAlert.threshold =
          alertDefinition.threshold;

        existingAlert.message =
          alertDefinition.message;

        existingAlert.severity =
          alertDefinition.severity;

        existingAlert.metadata = {
          ...(existingAlert.metadata || {}),
          source: "TELEMETRY",
          telemetryId:
            telemetry._id || null,
          smokeRaw:
            telemetry.smokeRaw ?? null,
          gasRaw:
            telemetry.gasRaw ?? null,
          noiseRaw:
            telemetry.noiseRaw ?? null,
          fireRaw:
            telemetry.fireRaw ?? null,
        };

        await existingAlert.save();

        emitAlertUpdate({
          deviceId: normalizedDeviceId,
          action: "ACTIVE",
          alert: existingAlert.toObject(),
        });

        alertResults.push({
          sensor,
          severity:
            alertDefinition.severity,
          created: false,
          duplicate: true,
          resolved: false,
          alertId:
            existingAlert._id,
        });

        continue;
      }

      // ---------------------------------------------
      // CREATE NEW ALERT
      // ---------------------------------------------

      const newAlert = await Alert.create({
        deviceId: normalizedDeviceId,

        sensor,

        severity:
          alertDefinition.severity,

        title:
          alertDefinition.title,

        message:
          alertDefinition.message,

        source: "TELEMETRY",

        value:
          alertDefinition.value,

        unit:
          alertDefinition.unit,

        status: "ACTIVE",

        recordId:
          telemetry._id || null,

        triggeredAt:
          telemetryTimestamp,

        lastSeenAt:
          telemetryTimestamp,

        lastValue:
          value,

        metadata: {
          source: "TELEMETRY",

          telemetryId:
            telemetry._id || null,

          smokeRaw:
            telemetry.smokeRaw ?? null,

          gasRaw:
            telemetry.gasRaw ?? null,

          noiseRaw:
            telemetry.noiseRaw ?? null,

          fireRaw:
            telemetry.fireRaw ?? null,

          threshold:
            alertDefinition.threshold,
        },
      });

      emitAlertUpdate({
        deviceId: normalizedDeviceId,
        action: "CREATED",
        alert: newAlert.toObject(),
      });

      alertResults.push({
        sensor,
        severity:
          alertDefinition.severity,
        created: true,
        duplicate: false,
        resolved: false,
        alertId:
          newAlert._id,
      });
    } catch (error) {
      console.error(
        `Alert creation/update error [${sensor}]:`,
        error
      );

      alertResults.push({
        sensor,
        severity:
          alertDefinition.severity,
        created: false,
        duplicate: false,
        resolved: false,
        alertId: null,
        error: error.message,
      });
    }
  }

  return {
    evaluated: true,
    activeConditions:
      alertResults.filter(
        (item) =>
          item.severity &&
          !item.resolved
      ).length,
    alerts: alertResults,
  };
}

// =====================================================
// POST /api/devices/telemetry
// =====================================================

async function receiveTelemetry(req, res) {
  try {
    // =================================================
    // DEVICE AUTHENTICATION
    // =================================================

    if (!req.device) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated device context is missing",
      });
    }

    // =================================================
    // DEVICE ID
    // =================================================

    const normalizedDeviceId =
      normalizeDeviceId(
        req.device.deviceId
      );

    if (!normalizedDeviceId) {
      return res.status(400).json({
        success: false,
        message: "Device ID is required",
      });
    }

    // =================================================
    // READ TELEMETRY DATA
    // =================================================

    const {
      temperature,
      humidity,

      // Processed values
      smoke,
      gas,
      noise,
      fire,

      // Raw ADC values
      smokeRaw,
      gasRaw,
      noiseRaw,
      fireRaw,

      // Actuator states
      pump,
      fan,
      buzzer,
      redLed,
      greenLed,

      // Network
      wifiRSSI,

      // Optional timestamp
      timestamp,

      // Optional firmware version
      firmwareVersion,
    } = req.body || {};

    // =================================================
    // CONVERT SENSOR VALUES
    // =================================================

    const processedValues = {
      temperature:
        toNumberOrNull(
          temperature
        ),

      humidity:
        toNumberOrNull(
          humidity
        ),

      smoke:
        toNumberOrNull(
          smoke
        ),

      gas:
        toNumberOrNull(
          gas
        ),

      noise:
        toNumberOrNull(
          noise
        ),

      fire:
        toNumberOrNull(
          fire
        ),
    };

    const rawValues = {
      smokeRaw:
        toNumberOrNull(
          smokeRaw
        ),

      gasRaw:
        toNumberOrNull(
          gasRaw
        ),

      noiseRaw:
        toNumberOrNull(
          noiseRaw
        ),

      fireRaw:
        toNumberOrNull(
          fireRaw
        ),
    };

    // =================================================
    // VALIDATE PROCESSED SENSOR DATA
    // =================================================

    for (
      const [sensor, value] of Object.entries(
        processedValues
      )
    ) {
      if (
        value !== null &&
        !Number.isFinite(value)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${sensor} must be a valid number`,
        });
      }
    }

    // =================================================
    // VALIDATE RAW SENSOR DATA
    // =================================================

    for (
      const [sensor, value] of Object.entries(
        rawValues
      )
    ) {
      if (
        value !== null &&
        !Number.isFinite(value)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${sensor} must be a valid number`,
        });
      }
    }

    // =================================================
    // VALIDATE ESP32 ADC RAW RANGE
    // =================================================
    // 12-bit ADC:
    // 0 - 4095
    // =================================================

    for (
      const [sensor, value] of Object.entries(
        rawValues
      )
    ) {
      if (
        value !== null &&
        (value < 0 || value > 4095)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${sensor} must be between 0 and 4095`,
        });
      }
    }

    // =================================================
    // VALIDATE NORMALIZED VALUES
    // =================================================
    // Smoke, gas, noise and fire:
    // 0 - 100
    // =================================================

    const normalizedValues = {
      smoke:
        processedValues.smoke,

      gas:
        processedValues.gas,

      noise:
        processedValues.noise,

      fire:
        processedValues.fire,
    };

    for (
      const [sensor, value] of Object.entries(
        normalizedValues
      )
    ) {
      if (
        value !== null &&
        (value < 0 || value > 100)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `${sensor} must be between 0 and 100`,
        });
      }
    }

    // =================================================
    // VALIDATE TEMPERATURE
    // =================================================

    if (
      processedValues.temperature !== null &&
      (processedValues.temperature < -50 ||
        processedValues.temperature > 100)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "temperature must be between -50 and 100°C",
      });
    }

    // =================================================
    // VALIDATE HUMIDITY
    // =================================================

    if (
      processedValues.humidity !== null &&
      (processedValues.humidity < 0 ||
        processedValues.humidity > 100)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "humidity must be between 0 and 100%",
      });
    }

    // =================================================
    // VALIDATE TIMESTAMP
    // =================================================

    let telemetryTimestamp =
      new Date();

    if (timestamp) {
      const parsedTimestamp =
        new Date(timestamp);

      if (
        !Number.isNaN(
          parsedTimestamp.getTime()
        )
      ) {
        telemetryTimestamp =
          parsedTimestamp;
      }
    }

    // =================================================
    // CALCULATE SAFETY STATUS
    // =================================================
    // IMPORTANT:
    // evaluateSafetyStatus() is now ASYNC
    // because thresholds come from MongoDB.
    // =================================================

    const safety =
      await evaluateSafetyStatus({
        temperature:
          processedValues.temperature,

        humidity:
          processedValues.humidity,

        smoke:
          processedValues.smoke,

        gas:
          processedValues.gas,

        noise:
          processedValues.noise,

        fire:
          processedValues.fire,
      });

    // =================================================
    // CREATE TELEMETRY RECORD
    // =================================================

    const telemetry =
      await Telemetry.create({
        deviceId:
          normalizedDeviceId,

        // ---------------------------------------------
        // Processed sensor values
        // ---------------------------------------------

        temperature:
          processedValues.temperature,

        humidity:
          processedValues.humidity,

        smoke:
          processedValues.smoke,

        gas:
          processedValues.gas,

        noise:
          processedValues.noise,

        fire:
          processedValues.fire,

        // ---------------------------------------------
        // Raw sensor values
        // ---------------------------------------------

        smokeRaw:
          rawValues.smokeRaw,

        gasRaw:
          rawValues.gasRaw,

        noiseRaw:
          rawValues.noiseRaw,

        fireRaw:
          rawValues.fireRaw,

        // ---------------------------------------------
        // Safety
        // ---------------------------------------------

        safetyStatus:
          safety.status,

        safetyReason:
          safety.reason,

        // ---------------------------------------------
        // Actuators
        // ---------------------------------------------

        pump:
          toBoolean(
            pump,
            false
          ),

        fan:
          toBoolean(
            fan,
            false
          ),

        buzzer:
          toBoolean(
            buzzer,
            false
          ),

        redLed:
          toBoolean(
            redLed,
            false
          ),

        greenLed:
          toBoolean(
            greenLed,
            false
          ),

        // ---------------------------------------------
        // Network
        // ---------------------------------------------

        wifiRSSI:
          toNumberOrNull(
            wifiRSSI
          ),

        // ---------------------------------------------
        // Timestamp
        // ---------------------------------------------

        timestamp:
          telemetryTimestamp,
      });

    // =================================================
    // CONVERT ONCE FOR SOCKET + SERVICES
    // =================================================

    const telemetryObject =
      telemetry.toObject();

    // =================================================
    // DEVICE ONLINE / LAST SEEN
    // =================================================

    const deviceStatus =
      await markDeviceOnline(
        normalizedDeviceId,
        {
          wifiRSSI:
            toNumberOrNull(
              wifiRSSI
            ),

          ipAddress:
            req.ip,

          firmwareVersion:
            firmwareVersion ||
            undefined,
        }
      );

    // =================================================
    // REAL-TIME DEVICE STATUS
    // =================================================

    emitDeviceStatusUpdate({
      deviceId:
        normalizedDeviceId,

      status:
        deviceStatus.status,

      lastSeen:
        deviceStatus.lastSeen,

      reconnected:
        deviceStatus.wasOffline,

      wifiRSSI:
        toNumberOrNull(
          wifiRSSI
        ),

      ipAddress:
        req.ip,
    });

    // =================================================
    // ALERT ENGINE
    // =================================================

    let alertEngine = null;

    try {
      // Safety service already loaded the current
      // thresholds from SystemSettings.
      //
      // Reuse them from the safety result so the
      // telemetry status and alert engine use the
      // SAME thresholds for this telemetry record.

      const thresholds =
        safety.thresholds ||
        (await getSafetyThresholds());

      alertEngine =
        await processTelemetryAlerts(
          telemetryObject,
          normalizedDeviceId,
          telemetryTimestamp,
          thresholds
        );
    } catch (alertError) {
      console.error(
        "Alert Engine error:",
        alertError
      );

      alertEngine = {
        evaluated: false,
        activeConditions: 0,
        alerts: [],
        error:
          alertError.message,
      };
    }

    // =================================================
    // AUTOMATION ENGINE
    // =================================================

    let automation = null;

    try {
      automation =
        await processAutomation(
          telemetryObject
        );
    } catch (automationError) {
      console.error(
        "Automation processing error:",
        automationError
      );

      automation = {
        enabled: null,
        rulesChecked: 0,
        triggeredRules: 0,
        alertsCreated: 0,
        commandsCreated: 0,
        commandsExisting: 0,
        error:
          automationError.message,
      };
    }

    // =================================================
    // REAL-TIME TELEMETRY EVENT
    // =================================================

    emitTelemetryUpdate({
      deviceId:
        normalizedDeviceId,

      telemetry:
        telemetryObject,

      deviceStatus: {
        status:
          deviceStatus.status,

        lastSeen:
          deviceStatus.lastSeen,

        reconnected:
          deviceStatus.wasOffline,
      },

      alerts:
        alertEngine,

      automation,

      timestamp:
        telemetryTimestamp,
    });

    // =================================================
    // REAL-TIME DASHBOARD REFRESH
    // =================================================

    emitDashboardRefresh({
      reason:
        "TELEMETRY_RECEIVED",

      deviceId:
        normalizedDeviceId,

      safetyStatus:
        safety.status,

      safetyReason:
        safety.reason,
    });

    // =================================================
    // FINAL RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message:
        "Telemetry received successfully",

      data:
        telemetryObject,

      deviceStatus: {
        status:
          deviceStatus.status,

        lastSeen:
          deviceStatus.lastSeen,

        reconnected:
          deviceStatus.wasOffline,
      },

      safety: {
        status:
          safety.status,

        reason:
          safety.reason,

        reasons:
          safety.reasons,

        thresholds:
          safety.thresholds,
      },

      alerts:
        alertEngine,

      automation,
    });
  } catch (error) {
    console.error(
      "Telemetry error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to receive telemetry",

      error:
        error.message,
    });
  }
}

// =====================================================
// GET /api/devices/:deviceId/latest
// =====================================================

async function getLatestTelemetry(
  req,
  res
) {
  try {
    const deviceId =
      normalizeDeviceId(
        req.params.deviceId
      );

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message:
          "Device ID is required",
      });
    }

    const telemetry =
      await Telemetry.findOne({
        deviceId,
      })
        .sort({
          timestamp: -1,
        })
        .lean();

    if (!telemetry) {
      return res.status(404).json({
        success: false,
        message:
          "No telemetry found for this device",
      });
    }

    return res.json({
      success: true,
      data: telemetry,
    });
  } catch (error) {
    console.error(
      "Latest telemetry error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch latest telemetry",
      error:
        error.message,
    });
  }
}

// =====================================================
// GET /api/devices/:deviceId/history
// =====================================================

async function getTelemetryHistory(
  req,
  res
) {
  try {
    const deviceId =
      normalizeDeviceId(
        req.params.deviceId
      );

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message:
          "Device ID is required",
      });
    }

    const limit =
      Math.min(
        Math.max(
          parseInt(
            req.query.limit,
            10
          ) || 100,
          1
        ),
        1000
      );

    const telemetry =
      await Telemetry.find({
        deviceId,
      })
        .sort({
          timestamp: -1,
        })
        .limit(limit)
        .lean();

    return res.json({
      success: true,

      count:
        telemetry.length,

      data:
        telemetry,
    });
  } catch (error) {
    console.error(
      "Telemetry history error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch telemetry history",
      error:
        error.message,
    });
  }
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  receiveTelemetry,
  getLatestTelemetry,
  getTelemetryHistory,
};