const Alert = require("../models/Alert");

/**
 * Create a new persistent alert.
 *
 * IMPORTANT:
 * This service follows the current Alert model:
 * sensor
 * source
 * triggeredAt
 *
 * It does NOT use the old:
 * type
 * occurredAt
 */
async function createAlert({
  deviceId,
  sensor,
  type,
  severity,
  title,
  message,
  value = null,
  threshold = null,
  unit = "%",
  source = "SYSTEM",
  metadata = {},
  triggeredAt = new Date(),
  occurredAt = null,
  recordId = null,
}) {
  const normalizedDeviceId = String(deviceId)
    .trim()
    .toUpperCase();

  // Backward compatibility:
  // If old callers still send `type`, use it as sensor.
  const normalizedSensor = String(
    sensor || type || ""
  )
    .trim()
    .toLowerCase();

  if (!normalizedSensor) {
    throw new Error(
      "Alert sensor is required."
    );
  }

  // Backward compatibility:
  // If old callers send occurredAt, use it.
  const finalTriggeredAt =
    triggeredAt ||
    occurredAt ||
    new Date();

  // Prevent duplicate ACTIVE / ACKNOWLEDGED
  // alerts for the same device and sensor.
  const existingAlert = await Alert.findOne({
    deviceId: normalizedDeviceId,
    sensor: normalizedSensor,
    status: {
      $in: [
        "ACTIVE",
        "ACKNOWLEDGED",
      ],
    },
  });

  if (existingAlert) {
    return {
      created: false,
      duplicate: true,
      alert: existingAlert,
    };
  }

  const alert = await Alert.create({
    deviceId: normalizedDeviceId,

    sensor: normalizedSensor,

    severity,

    title,

    message,

    source: source || "SYSTEM",

    value,

    unit,

    status: "ACTIVE",

    recordId,

    triggeredAt: finalTriggeredAt,

    lastSeenAt: finalTriggeredAt,

    lastValue: value,

    metadata: {
      ...(metadata || {}),

      threshold,

      source:
        source || "SYSTEM",
    },
  });

  console.log(
    `[ALERT] ${severity} | ${normalizedSensor} | ${normalizedDeviceId} | ${message}`
  );

  return {
    created: true,
    duplicate: false,
    alert,
  };
}


/**
 * Resolve an ACTIVE / ACKNOWLEDGED alert.
 */
async function resolveAlert({
  deviceId,
  sensor,
  type,
  resolvedBy = null,
}) {
  const normalizedDeviceId = String(deviceId)
    .trim()
    .toUpperCase();

  const normalizedSensor = String(
    sensor || type || ""
  )
    .trim()
    .toLowerCase();

  if (!normalizedSensor) {
    return {
      resolved: false,
      message: "Alert sensor is required.",
    };
  }

  const alert = await Alert.findOne({
    deviceId: normalizedDeviceId,

    sensor: normalizedSensor,

    status: {
      $in: [
        "ACTIVE",
        "ACKNOWLEDGED",
      ],
    },
  }).sort({
    triggeredAt: -1,
  });

  if (!alert) {
    return {
      resolved: false,
      message: "No active alert found",
    };
  }

  alert.status = "RESOLVED";

  alert.resolvedBy =
    resolvedBy || null;

  alert.resolvedAt =
    new Date();

  alert.metadata = {
    ...(alert.metadata || {}),

    lastAction: "RESOLVED",

    lastActionAt:
      new Date(),
  };

  await alert.save();

  console.log(
    `[ALERT RESOLVED] ${normalizedSensor} | ${normalizedDeviceId}`
  );

  return {
    resolved: true,
    alert,
  };
}


/**
 * Check whether an ACTIVE / ACKNOWLEDGED
 * alert exists.
 */
async function hasActiveAlert(
  deviceId,
  sensor,
  type
) {
  const normalizedDeviceId =
    String(deviceId)
      .trim()
      .toUpperCase();

  const normalizedSensor = String(
    sensor || type || ""
  )
    .trim()
    .toLowerCase();

  if (!normalizedSensor) {
    return false;
  }

  const alert =
    await Alert.findOne({
      deviceId:
        normalizedDeviceId,

      sensor:
        normalizedSensor,

      status: {
        $in: [
          "ACTIVE",
          "ACKNOWLEDGED",
        ],
      },
    }).lean();

  return Boolean(alert);
}


module.exports = {
  createAlert,
  resolveAlert,
  hasActiveAlert,
};