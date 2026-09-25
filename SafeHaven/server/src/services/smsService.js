const NotificationLog = require("../models/NotificationLog");
const SystemSettings = require("../models/SystemSettings");
const Command = require("../models/Command");

// ============================================================
// GET SMS SETTINGS
// ============================================================

async function getSMSSettings() {
  let settings = await SystemSettings.findOne();

  if (!settings) {
    settings = await SystemSettings.create({});
  }

  return settings;
}

// ============================================================
// CHECK WHETHER SMS SHOULD BE CREATED
// ============================================================

async function shouldSendSMS({
  deviceId,
  severity,
  alertId = null,
}) {
  const settings = await getSMSSettings();

  // ----------------------------------------------------------
  // SMS ENABLED CHECK
  // ----------------------------------------------------------

  if (!settings.sms.enabled) {
    return {
      shouldSend: false,
      reason: "SMS notifications are disabled",
      settings,
    };
  }

  // ----------------------------------------------------------
  // NOTIFICATION SMS ENABLED CHECK
  // ----------------------------------------------------------

  if (!settings.notifications.sms) {
    return {
      shouldSend: false,
      reason:
        "SMS notifications are disabled in notification settings",
      settings,
    };
  }

  // ----------------------------------------------------------
  // RECIPIENT CHECK
  // ----------------------------------------------------------

  if (
    !Array.isArray(settings.sms.phoneNumbers) ||
    settings.sms.phoneNumbers.length === 0
  ) {
    return {
      shouldSend: false,
      reason: "No SMS recipients configured",
      settings,
    };
  }

  // ----------------------------------------------------------
  // SEVERITY CHECK
  // ----------------------------------------------------------

  if (!["DANGER", "CRITICAL"].includes(severity)) {
    return {
      shouldSend: false,
      reason: `SMS not required for ${severity} severity`,
      settings,
    };
  }

  // ----------------------------------------------------------
  // DUPLICATE ALERT CHECK
  // ----------------------------------------------------------

  if (alertId) {
    const existingAlertSMS =
      await NotificationLog.findOne({
        alertId,
        type: "SMS",
        status: {
          $in: ["PENDING", "SENT"],
        },
      })
        .sort({ createdAt: -1 })
        .lean();

    if (existingAlertSMS) {
      return {
        shouldSend: false,
        reason:
          "SMS already created for this alert",
        duplicate: true,
        existingNotificationId:
          existingAlertSMS._id,
        settings,
      };
    }
  }

  // ----------------------------------------------------------
  // COOLDOWN CHECK
  // ----------------------------------------------------------

  const cooldownSeconds =
    settings.sms.cooldownSeconds || 60;

  const cooldownStart = new Date(
    Date.now() -
      cooldownSeconds * 1000
  );

  const recentSMS =
    await NotificationLog.findOne({
      deviceId,
      type: "SMS",
      status: {
        $in: ["PENDING", "SENT"],
      },
      createdAt: {
        $gte: cooldownStart,
      },
    })
      .sort({ createdAt: -1 })
      .lean();

  if (recentSMS) {
    return {
      shouldSend: false,
      reason:
        `SMS cooldown active. Last SMS was sent less than ${cooldownSeconds} seconds ago.`,
      cooldownActive: true,
      lastSMSAt: recentSMS.createdAt,
      settings,
    };
  }

  return {
    shouldSend: true,
    reason: "SMS notification is allowed",
    cooldownActive: false,
    duplicate: false,
    settings,
  };
}

// ============================================================
// CREATE SMS NOTIFICATION LOGS
// ============================================================

async function createSMSLogs({
  deviceId,
  message,
  alertId = null,
}) {
  const settings = await getSMSSettings();

  const phoneNumbers =
    settings.sms.phoneNumbers || [];

  if (phoneNumbers.length === 0) {
    return [];
  }

  const logs = [];

  for (const phoneNumber of phoneNumbers) {
    const log = await NotificationLog.create({
      deviceId,
      type: "SMS",
      recipient: phoneNumber,
      message,
      status: "PENDING",
      alertId,
      commandId: null,
    });

    logs.push(log);
  }

  return logs;
}

// ============================================================
// CREATE SMS COMMAND FOR A NOTIFICATION
// ============================================================

async function createSMSCommandForNotification(
  notificationLog
) {
  if (!notificationLog) {
    throw new Error(
      "Notification log is required"
    );
  }

  if (notificationLog.type !== "SMS") {
    throw new Error(
      "Notification log must be of type SMS"
    );
  }

  if (!notificationLog.deviceId) {
    throw new Error(
      "Notification log deviceId is required"
    );
  }

  // ----------------------------------------------------------
  // DUPLICATE COMMAND PROTECTION
  // ----------------------------------------------------------

  if (notificationLog.commandId) {
    const existingCommand =
      await Command.findById(
        notificationLog.commandId
      );

    if (existingCommand) {
      return {
        created: false,
        duplicate: true,
        command: existingCommand,
      };
    }
  }

  // ----------------------------------------------------------
  // ADDITIONAL DATABASE DUPLICATE CHECK
  // ----------------------------------------------------------

  const existingCommand =
    await Command.findOne({
      deviceId: notificationLog.deviceId,
      command: "SMS_SEND",
      "parameters.notificationId":
        String(notificationLog._id),
      status: {
        $in: [
          "PENDING",
          "SENT",
          "EXECUTED",
        ],
      },
    }).sort({
      createdAt: -1,
    });

  if (existingCommand) {
    await NotificationLog.findByIdAndUpdate(
      notificationLog._id,
      {
        $set: {
          commandId: existingCommand._id,
        },
      }
    );

    return {
      created: false,
      duplicate: true,
      command: existingCommand,
    };
  }

  // ----------------------------------------------------------
  // CREATE SMS COMMAND
  // ----------------------------------------------------------

  const command =
    await Command.create({
      deviceId:
        notificationLog.deviceId,

      command: "SMS_SEND",

      source: "SYSTEM",

      priority: "CRITICAL",

      parameters: {
        recipient:
          notificationLog.recipient,

        message:
          notificationLog.message,

        notificationId:
          String(notificationLog._id),
      },

      reason:
        "SMS notification delivery",

      status: "PENDING",
    });

  // ----------------------------------------------------------
  // LINK COMMAND TO NOTIFICATION
  // ----------------------------------------------------------

  await NotificationLog.findByIdAndUpdate(
    notificationLog._id,
    {
      $set: {
        commandId: command._id,
        errorMessage: null,
      },
    }
  );

  return {
    created: true,
    duplicate: false,
    command,
  };
}

module.exports = {
  getSMSSettings,
  shouldSendSMS,
  createSMSLogs,
  createSMSCommandForNotification,
};