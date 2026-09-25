const Device = require("../models/Device");
const Alert = require("../models/Alert");
const Telemetry = require("../models/Telemetry");
const NotificationLog = require("../models/NotificationLog");
const Command = require("../models/Command");

// ============================================================
// DATE HELPERS
// ============================================================

function getTodayRange() {
  const now = new Date();

  // Server-local calendar day.
  // On the user's local Windows machine this will normally be IST.
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    startOfDay,
    endOfDay,
  };
}

// ============================================================
// GET DASHBOARD STATISTICS
// ============================================================

async function getDashboardStatistics(req, res) {
  try {
    const { startOfDay, endOfDay } = getTodayRange();

    // --------------------------------------------------------
    // DEVICE STATISTICS
    // --------------------------------------------------------

    const [
      totalDevices,
      activeDevices,
      onlineDevices,
      offlineDevices,
    ] = await Promise.all([
      Device.countDocuments({}),
      Device.countDocuments({ isActive: true }),
      Device.countDocuments({
        isActive: true,
        status: "ONLINE",
      }),
      Device.countDocuments({
        isActive: true,
        status: "OFFLINE",
      }),
    ]);

    // --------------------------------------------------------
    // TODAY'S ALERT STATISTICS
    // --------------------------------------------------------

    const alertStats = await Alert.aggregate([
      {
        $match: {
          occurredAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },

          warning: {
            $sum: {
              $cond: [
                { $eq: ["$severity", "WARNING"] },
                1,
                0,
              ],
            },
          },

          danger: {
            $sum: {
              $cond: [
                { $eq: ["$severity", "DANGER"] },
                1,
                0,
              ],
            },
          },

          critical: {
            $sum: {
              $cond: [
                { $eq: ["$severity", "CRITICAL"] },
                1,
                0,
              ],
            },
          },

          active: {
            $sum: {
              $cond: [
                { $eq: ["$status", "ACTIVE"] },
                1,
                0,
              ],
            },
          },

          acknowledged: {
            $sum: {
              $cond: [
                { $eq: ["$status", "ACKNOWLEDGED"] },
                1,
                0,
              ],
            },
          },

          resolved: {
            $sum: {
              $cond: [
                { $eq: ["$status", "RESOLVED"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const todayAlerts = alertStats[0] || {
      total: 0,
      warning: 0,
      danger: 0,
      critical: 0,
      active: 0,
      acknowledged: 0,
      resolved: 0,
    };

    // --------------------------------------------------------
    // TODAY'S TELEMETRY STATISTICS
    // --------------------------------------------------------

    const telemetryStats = await Telemetry.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          averageTemperature: {
            $avg: "$temperature",
          },

          averageHumidity: {
            $avg: "$humidity",
          },

          averageSmoke: {
            $avg: "$smoke",
          },

          averageGas: {
            $avg: "$gas",
          },

          averageNoise: {
            $avg: "$noise",
          },

          averageFire: {
            $avg: "$fire",
          },

          safeCount: {
            $sum: {
              $cond: [
                { $eq: ["$safetyStatus", "SAFE"] },
                1,
                0,
              ],
            },
          },

          warningCount: {
            $sum: {
              $cond: [
                { $eq: ["$safetyStatus", "WARNING"] },
                1,
                0,
              ],
            },
          },

          dangerCount: {
            $sum: {
              $cond: [
                { $eq: ["$safetyStatus", "DANGER"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const todayTelemetry = telemetryStats[0] || {
      total: 0,
      averageTemperature: null,
      averageHumidity: null,
      averageSmoke: null,
      averageGas: null,
      averageNoise: null,
      averageFire: null,
      safeCount: 0,
      warningCount: 0,
      dangerCount: 0,
    };

    // --------------------------------------------------------
    // LATEST TELEMETRY
    // --------------------------------------------------------

    const latestTelemetry = await Telemetry.findOne({})
      .sort({ timestamp: -1 })
      .lean();

    // --------------------------------------------------------
    // TODAY'S NOTIFICATION STATISTICS
    // --------------------------------------------------------

    const notificationStats = await NotificationLog.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          pending: {
            $sum: {
              $cond: [
                { $eq: ["$status", "PENDING"] },
                1,
                0,
              ],
            },
          },

          sent: {
            $sum: {
              $cond: [
                { $eq: ["$status", "SENT"] },
                1,
                0,
              ],
            },
          },

          failed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "FAILED"] },
                1,
                0,
              ],
            },
          },

          unread: {
            $sum: {
              $cond: [
                { $eq: ["$isRead", false] },
                1,
                0,
              ],
            },
          },

          sms: {
            $sum: {
              $cond: [
                { $eq: ["$type", "SMS"] },
                1,
                0,
              ],
            },
          },

          browser: {
            $sum: {
              $cond: [
                { $eq: ["$type", "BROWSER"] },
                1,
                0,
              ],
            },
          },

          system: {
            $sum: {
              $cond: [
                { $eq: ["$type", "SYSTEM"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const todayNotifications = notificationStats[0] || {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      unread: 0,
      sms: 0,
      browser: 0,
      system: 0,
    };

    // --------------------------------------------------------
    // TODAY'S COMMAND STATISTICS
    // --------------------------------------------------------

    const commandStats = await Command.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },
      {
        $group: {
          _id: null,

          total: { $sum: 1 },

          pending: {
            $sum: {
              $cond: [
                { $eq: ["$status", "PENDING"] },
                1,
                0,
              ],
            },
          },

          sent: {
            $sum: {
              $cond: [
                { $eq: ["$status", "SENT"] },
                1,
                0,
              ],
            },
          },

          executed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "EXECUTED"] },
                1,
                0,
              ],
            },
          },

          failed: {
            $sum: {
              $cond: [
                { $eq: ["$status", "FAILED"] },
                1,
                0,
              ],
            },
          },

          expired: {
            $sum: {
              $cond: [
                { $eq: ["$status", "EXPIRED"] },
                1,
                0,
              ],
            },
          },

          automation: {
            $sum: {
              $cond: [
                { $eq: ["$source", "AUTOMATION"] },
                1,
                0,
              ],
            },
          },

          manual: {
            $sum: {
              $cond: [
                { $eq: ["$source", "MANUAL"] },
                1,
                0,
              ],
            },
          },

          system: {
            $sum: {
              $cond: [
                { $eq: ["$source", "SYSTEM"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const todayCommands = commandStats[0] || {
      total: 0,
      pending: 0,
      sent: 0,
      executed: 0,
      failed: 0,
      expired: 0,
      automation: 0,
      manual: 0,
      system: 0,
    };

    // --------------------------------------------------------
    // LAST ACTIVITY
    // --------------------------------------------------------

    const [
      latestAlert,
      latestNotification,
      latestCommand,
      latestDevice,
    ] = await Promise.all([
      Alert.findOne({})
        .sort({ occurredAt: -1 })
        .select("deviceId type severity occurredAt title")
        .lean(),

      NotificationLog.findOne({})
        .sort({ createdAt: -1 })
        .select("deviceId type status createdAt")
        .lean(),

      Command.findOne({})
        .sort({ createdAt: -1 })
        .select("deviceId command status source createdAt")
        .lean(),

      Device.findOne({})
        .sort({ lastSeen: -1 })
        .select("deviceId status lastSeen")
        .lean(),
    ]);

    const activityDates = [
      latestTelemetry?.timestamp,
      latestAlert?.occurredAt,
      latestNotification?.createdAt,
      latestCommand?.createdAt,
      latestDevice?.lastSeen,
    ]
      .filter(Boolean)
      .map((date) => new Date(date));

    const lastActivityAt =
      activityDates.length > 0
        ? new Date(
            Math.max(
              ...activityDates.map((date) => date.getTime())
            )
          )
        : null;

    // --------------------------------------------------------
    // SYSTEM SAFETY STATUS
    // --------------------------------------------------------

    let systemSafetyStatus = "UNKNOWN";
    let systemSafetyReason = "No telemetry available";

    if (latestTelemetry) {
      systemSafetyStatus = latestTelemetry.safetyStatus || "UNKNOWN";
      systemSafetyReason =
        latestTelemetry.safetyReason ||
        "No safety reason available";
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.json({
      success: true,

      data: {
        date: startOfDay.toISOString().slice(0, 10),

        devices: {
          total: totalDevices,
          active: activeDevices,
          online: onlineDevices,
          offline: offlineDevices,
        },

        alerts: {
          today: {
            total: todayAlerts.total,
            warning: todayAlerts.warning,
            danger: todayAlerts.danger,
            critical: todayAlerts.critical,
            active: todayAlerts.active,
            acknowledged: todayAlerts.acknowledged,
            resolved: todayAlerts.resolved,
          },
        },

        telemetry: {
          today: {
            total: todayTelemetry.total,

            averages: {
              temperature: todayTelemetry.averageTemperature,
              humidity: todayTelemetry.averageHumidity,
              smoke: todayTelemetry.averageSmoke,
              gas: todayTelemetry.averageGas,
              noise: todayTelemetry.averageNoise,
              fire: todayTelemetry.averageFire,
            },

            safety: {
              safe: todayTelemetry.safeCount,
              warning: todayTelemetry.warningCount,
              danger: todayTelemetry.dangerCount,
            },
          },

          latest: latestTelemetry
            ? {
                deviceId: latestTelemetry.deviceId,
                temperature: latestTelemetry.temperature,
                humidity: latestTelemetry.humidity,
                smoke: latestTelemetry.smoke,
                gas: latestTelemetry.gas,
                noise: latestTelemetry.noise,
                fire: latestTelemetry.fire,

                safetyStatus: latestTelemetry.safetyStatus,
                safetyReason: latestTelemetry.safetyReason,

                actuators: {
                  pump: latestTelemetry.pump,
                  fan: latestTelemetry.fan,
                  buzzer: latestTelemetry.buzzer,
                  redLed: latestTelemetry.redLed,
                  greenLed: latestTelemetry.greenLed,
                },

                wifiRSSI: latestTelemetry.wifiRSSI,
                timestamp: latestTelemetry.timestamp,
              }
            : null,
        },

        notifications: {
          today: {
            total: todayNotifications.total,
            pending: todayNotifications.pending,
            sent: todayNotifications.sent,
            failed: todayNotifications.failed,
            unread: todayNotifications.unread,

            byType: {
              sms: todayNotifications.sms,
              browser: todayNotifications.browser,
              system: todayNotifications.system,
            },
          },
        },

        commands: {
          today: {
            total: todayCommands.total,
            pending: todayCommands.pending,
            sent: todayCommands.sent,
            executed: todayCommands.executed,
            failed: todayCommands.failed,
            expired: todayCommands.expired,

            bySource: {
              automation: todayCommands.automation,
              manual: todayCommands.manual,
              system: todayCommands.system,
            },
          },
        },

        system: {
          safetyStatus: systemSafetyStatus,
          safetyReason: systemSafetyReason,
          lastActivityAt,
        },

        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "Dashboard statistics error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
}

module.exports = {
  getDashboardStatistics,
};