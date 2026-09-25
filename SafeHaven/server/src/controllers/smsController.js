const {
  shouldSendSMS,
  createSMSLogs,
} = require("../services/smsService");

async function checkSMSDecision(req, res) {
  try {
    const {
      deviceId,
      severity,
      alertId = null,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    if (!severity) {
      return res.status(400).json({
        success: false,
        message: "severity is required",
      });
    }

    const normalizedDeviceId = String(deviceId)
      .trim()
      .toUpperCase();

    const normalizedSeverity = String(severity)
      .trim()
      .toUpperCase();

    const allowedSeverities = [
      "SAFE",
      "WARNING",
      "DANGER",
      "CRITICAL",
    ];

    if (!allowedSeverities.includes(normalizedSeverity)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid severity. Allowed values: SAFE, WARNING, DANGER, CRITICAL",
      });
    }

    const decision = await shouldSendSMS({
      deviceId: normalizedDeviceId,
      severity: normalizedSeverity,
      alertId,
    });

    return res.json({
      success: true,
      data: {
        deviceId: normalizedDeviceId,
        severity: normalizedSeverity,
        alertId,

        shouldSendSMS: decision.shouldSend,

        reason: decision.reason,

        cooldownActive:
          decision.cooldownActive || false,

        duplicate:
          decision.duplicate || false,

        existingNotificationId:
          decision.existingNotificationId || null,

        lastSMSAt:
          decision.lastSMSAt || null,

        smsEnabled:
          decision.settings.sms.enabled,

        recipientsConfigured:
          Array.isArray(
            decision.settings.sms.phoneNumbers
          ) &&
          decision.settings.sms.phoneNumbers.length > 0,

        cooldownSeconds:
          decision.settings.sms.cooldownSeconds,
      },
    });
  } catch (error) {
    console.error(
      "SMS decision error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Failed to evaluate SMS decision",
    });
  }
}

async function createSMSNotification(req, res) {
  try {
    const {
      deviceId,
      severity,
      message,
      alertId = null,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    if (!severity) {
      return res.status(400).json({
        success: false,
        message: "severity is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message is required",
      });
    }

    const normalizedDeviceId = String(deviceId)
      .trim()
      .toUpperCase();

    const normalizedSeverity = String(severity)
      .trim()
      .toUpperCase();

    const allowedSeverities = [
      "DANGER",
      "CRITICAL",
    ];

    if (!allowedSeverities.includes(normalizedSeverity)) {
      return res.status(400).json({
        success: false,
        message:
          "SMS notification is only allowed for DANGER or CRITICAL severity",
      });
    }

    const decision = await shouldSendSMS({
      deviceId: normalizedDeviceId,
      severity: normalizedSeverity,
      alertId,
    });

    // -------------------------------------------------------
    // BLOCK DUPLICATE OR COOLDOWN
    // -------------------------------------------------------
    if (!decision.shouldSend) {
      return res.status(200).json({
        success: true,
        data: {
          smsSent: false,
          logsCreated: 0,
          blocked: true,

          reason: decision.reason,

          cooldownActive:
            decision.cooldownActive || false,

          duplicate:
            decision.duplicate || false,

          existingNotificationId:
            decision.existingNotificationId || null,

          lastSMSAt:
            decision.lastSMSAt || null,
        },
      });
    }

    const logs = await createSMSLogs({
      deviceId: normalizedDeviceId,
      message,
      alertId,
    });

    if (logs.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          smsSent: false,
          logsCreated: 0,
          blocked: true,
          reason:
            "No SMS recipients configured",
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        smsSent: false,
        queued: true,

        logsCreated: logs.length,

        severity: normalizedSeverity,

        message,

        alertId,

        notificationIds: logs.map(
          (log) => log._id
        ),

        reason:
          "SMS notification queued for processing",
      },
    });
  } catch (error) {
    console.error(
      "Create SMS notification error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create SMS notification",
    });
  }
}

module.exports = {
  checkSMSDecision,
  createSMSNotification,
};