const Command = require("../models/Command");
const Device = require("../models/Device");
const NotificationLog = require("../models/NotificationLog");
const Activity = require("../models/Activity");

const {
  emitCommandUpdate,
  emitNotificationUpdate,
  emitDashboardRefresh,
} = require("../services/socketService");

// ============================================================
// HELPER - NORMALIZE DEVICE ID
// ============================================================

function normalizeDeviceId(deviceId) {
  return String(deviceId || "")
    .trim()
    .toUpperCase();
}

// ============================================================
// HELPER - COMMAND ACTIVITY TITLE
// ============================================================

function getCommandActivityTitle(command) {
  const commandMap = {
    PUMP_ON: "Water pump turned ON",
    PUMP_OFF: "Water pump turned OFF",

    FAN_ON: "Exhaust fan turned ON",
    FAN_OFF: "Exhaust fan turned OFF",

    BUZZER_ON: "Safety buzzer turned ON",
    BUZZER_OFF: "Safety buzzer turned OFF",

    RED_LED_ON: "Red LED turned ON",
    RED_LED_OFF: "Red LED turned OFF",

    GREEN_LED_ON: "Green LED turned ON",
    GREEN_LED_OFF: "Green LED turned OFF",

    ALL_ACTUATORS_OFF:
      "All safety actuators turned OFF",

    SMS_SEND: "Safety SMS command sent",
  };

  return (
    commandMap[command] ||
    String(
      command || "Unknown command"
    ).replaceAll("_", " ")
  );
}

// ============================================================
// HELPER - ACTIVITY TYPE FROM COMMAND SOURCE
// ============================================================

function getActivityType(source) {
  if (source === "AUTOMATION") {
    return "AUTOMATION";
  }

  if (source === "SYSTEM") {
    return "SYSTEM";
  }

  return "COMMAND";
}

// ============================================================
// HELPER - ACTIVITY SOURCE
// ============================================================

function getActivitySource(source) {
  if (source === "AUTOMATION") {
    return "AUTOMATION";
  }

  if (source === "SYSTEM") {
    return "SYSTEM";
  }

  return "MANUAL";
}

// ============================================================
// HELPER - RESOLVE MODE
// ============================================================

function resolveCommandMode(source, mode) {
  if (mode === "AUTO" || mode === "MANUAL") {
    return mode;
  }

  if (source === "AUTOMATION") {
    return "AUTO";
  }

  if (source === "MANUAL") {
    return "MANUAL";
  }

  return null;
}

// ============================================================
// POST /api/commands
// USER / ADMIN COMMAND CREATION
// Requires normal JWT authentication
// ============================================================

async function createCommand(req, res) {
  try {
    const {
      deviceId,
      command,
      source,
      mode,
      priority,
      parameters,
      reason,
    } = req.body;

    // --------------------------------------------------------
    // Validate device ID
    // --------------------------------------------------------

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    // --------------------------------------------------------
    // Validate command
    // --------------------------------------------------------

    if (!command) {
      return res.status(400).json({
        success: false,
        message: "command is required",
      });
    }

    // --------------------------------------------------------
    // Normalize device ID
    // --------------------------------------------------------

    const normalizedDeviceId =
      normalizeDeviceId(deviceId);

    // --------------------------------------------------------
    // Resolve source
    // --------------------------------------------------------

    const resolvedSource =
      source || "MANUAL";

    // --------------------------------------------------------
    // Resolve mode
    // --------------------------------------------------------

    const resolvedMode =
      resolveCommandMode(
        resolvedSource,
        mode
      );

    // --------------------------------------------------------
    // Verify active device
    // --------------------------------------------------------

    const device = await Device.findOne({
      deviceId: normalizedDeviceId,
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Active device not found",
      });
    }

    // ========================================================
    // CREATE COMMAND
    // ========================================================

    const newCommand = await Command.create({
      deviceId: normalizedDeviceId,

      command,

      source: resolvedSource,

      mode: resolvedMode,

      priority:
        priority || "NORMAL",

      parameters:
        parameters || {},

      reason:
        reason || null,

      status: "PENDING",

      createdBy:
        req.user?._id || null,
    });

    console.log("=================================");
    console.log("[COMMAND SAVED]");
    console.log("Command ID :", newCommand._id);
    console.log("Device     :", newCommand.deviceId);
    console.log("Command    :", newCommand.command);
    console.log("Source     :", newCommand.source);
    console.log("Mode       :", newCommand.mode);
    console.log("Priority   :", newCommand.priority);
    console.log("Status     :", newCommand.status);
    console.log("=================================");

    // ========================================================
    // CREATE ACTIVITY DATABASE RECORD
    //
    // ONE COMMAND = ONE ACTIVITY
    //
    // The same activity will later be updated:
    //
    // PENDING → SENT → SUCCESS / FAILED
    // ========================================================

    try {
      const activity =
        await Activity.create({
          deviceId:
            normalizedDeviceId,

          userId:
            req.user?._id || null,

          type:
            getActivityType(
              newCommand.source
            ),

          action:
            newCommand.command,

          title:
            getCommandActivityTitle(
              newCommand.command
            ),

          description:
            newCommand.source ===
            "MANUAL"
              ? "Manual command queued for ESP32 execution."
              : newCommand.source ===
                "AUTOMATION"
              ? "Automatic safety command queued for ESP32 execution."
              : "System command queued for ESP32 execution.",

          status: "PENDING",

          commandId:
            newCommand._id,

          mode:
            newCommand.mode,

          source:
            getActivitySource(
              newCommand.source
            ),

          metadata: {
            source:
              newCommand.source,

            mode:
              newCommand.mode,

            priority:
              newCommand.priority,

            parameters:
              newCommand.parameters,

            reason:
              newCommand.reason,

            commandStatus:
              newCommand.status,
          },

          timestamp:
            new Date(),
        });

      console.log(
        "[ACTIVITY SAVED]"
      );

      console.log(
        "Activity ID :",
        activity._id
      );

      console.log(
        "Command ID  :",
        newCommand._id
      );

      console.log(
        "Action      :",
        activity.action
      );

      console.log(
        "Mode        :",
        activity.mode
      );

      console.log(
        "Source      :",
        activity.source
      );
    } catch (activityError) {
      console.error(
        "[ACTIVITY SAVE FAILED]",
        activityError.message
      );
    }

    // ========================================================
    // SOCKET.IO - REAL-TIME COMMAND CREATED
    // ========================================================

    emitCommandUpdate({
      action: "CREATED",

      deviceId:
        normalizedDeviceId,

      command:
        newCommand.toObject(),
    });

    // ========================================================
    // SOCKET.IO - DASHBOARD REFRESH
    // ========================================================

    emitDashboardRefresh({
      reason:
        "COMMAND_CREATED",

      deviceId:
        normalizedDeviceId,

      commandId:
        newCommand._id,
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,

      message:
        "Command created successfully",

      data: newCommand,
    });
  } catch (error) {
    console.error(
      "Create command error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to create command",

      error:
        error.message,
    });
  }
}

// ============================================================
// GET /api/commands/:deviceId/pending
// ESP32 COMMAND POLLING
// Requires device authentication
// ============================================================

async function getPendingCommands(
  req,
  res
) {
  try {
    const requestedDeviceId =
      normalizeDeviceId(
        req.params.deviceId
      );

    // --------------------------------------------------------
    // Device identity from authenticated middleware
    // --------------------------------------------------------

    const authenticatedDeviceId =
      normalizeDeviceId(
        req.device.deviceId
      );

    // --------------------------------------------------------
    // Prevent cross-device command access
    // --------------------------------------------------------

    if (
      requestedDeviceId !==
      authenticatedDeviceId
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Device identity mismatch",
      });
    }

    // --------------------------------------------------------
    // Get pending commands
    // --------------------------------------------------------

    const commands =
      await Command.find({
        deviceId:
          authenticatedDeviceId,

        status: "PENDING",
      })
        .sort({
          priority: -1,
          createdAt: 1,
        })
        .limit(20)
        .lean();

    return res.json({
      success: true,

      count:
        commands.length,

      data:
        commands,
    });
  } catch (error) {
    console.error(
      "Get pending commands error:",
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch pending commands",
    });
  }
}

// ============================================================
// PATCH /api/commands/:commandId/sent
// ESP32 CONFIRMS COMMAND RECEIVED
// Requires device authentication
// ============================================================

async function markCommandSent(
  req,
  res
) {
  try {
    const {
      commandId,
    } = req.params;

    // --------------------------------------------------------
    // Find command
    // --------------------------------------------------------

    const command =
      await Command.findById(
        commandId
      );

    if (!command) {
      return res.status(404).json({
        success: false,

        message:
          "Command not found",
      });
    }

    // --------------------------------------------------------
    // Authenticated device
    // --------------------------------------------------------

    const authenticatedDeviceId =
      normalizeDeviceId(
        req.device.deviceId
      );

    const commandDeviceId =
      normalizeDeviceId(
        command.deviceId
      );

    // --------------------------------------------------------
    // Device authorization
    // --------------------------------------------------------

    if (
      commandDeviceId !==
      authenticatedDeviceId
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Device is not authorized for this command",
      });
    }

    // --------------------------------------------------------
    // Only PENDING → SENT
    // --------------------------------------------------------

    if (
      command.status !==
      "PENDING"
    ) {
      return res.status(400).json({
        success: false,

        message:
          `Command cannot be marked as sent from status ${command.status}`,
      });
    }

    // --------------------------------------------------------
    // Update command
    // --------------------------------------------------------

    command.status = "SENT";

    command.sentAt =
      new Date();

    await command.save();

    console.log(
      "[COMMAND SENT]",
      command._id
    );

    // ========================================================
    // UPDATE SAME ACTIVITY
    // ========================================================

    try {
      const updatedActivity =
        await Activity.findOneAndUpdate(
          {
            commandId:
              command._id,
          },

          {
            $set: {
              description:
                "ESP32 received the command and is processing it.",

              "metadata.commandStatus":
                "SENT",

              "metadata.sentAt":
                command.sentAt,

              "metadata.deviceId":
                authenticatedDeviceId,

              mode:
                command.mode,

              source:
                getActivitySource(
                  command.source
                ),
            },
          },

          {
            new: true,
          }
        );

      if (updatedActivity) {
        console.log(
          "[ACTIVITY UPDATED] Command SENT:",
          command._id
        );
      } else {
        console.warn(
          "[ACTIVITY NOT FOUND FOR COMMAND]",
          command._id
        );
      }
    } catch (activityError) {
      console.error(
        "[ACTIVITY SENT UPDATE FAILED]",
        activityError.message
      );
    }

    // ========================================================
    // SOCKET.IO - COMMAND SENT
    // ========================================================

    emitCommandUpdate({
      action: "SENT",

      deviceId:
        authenticatedDeviceId,

      command:
        command.toObject(),
    });

    // ========================================================
    // DASHBOARD REFRESH
    // ========================================================

    emitDashboardRefresh({
      reason:
        "COMMAND_SENT",

      deviceId:
        authenticatedDeviceId,

      commandId:
        command._id,
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.json({
      success: true,

      message:
        "Command marked as sent",

      data:
        command,
    });
  } catch (error) {
    console.error(
      "Mark command sent error:",
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to update command",
    });
  }
}

// ============================================================
// PATCH /api/commands/:commandId/result
// ESP32 REPORTS EXECUTION RESULT
// Requires device authentication
// ============================================================

async function updateCommandResult(
  req,
  res
) {
  try {
    const {
      commandId,
    } = req.params;

    const {
      status,
      errorMessage,
    } = req.body;

    // --------------------------------------------------------
    // Validate result status
    // --------------------------------------------------------

    if (
      ![
        "EXECUTED",
        "FAILED",
      ].includes(status)
    ) {
      return res.status(400).json({
        success: false,

        message:
          "status must be EXECUTED or FAILED",
      });
    }

    // --------------------------------------------------------
    // Find command
    // --------------------------------------------------------

    const command =
      await Command.findById(
        commandId
      );

    if (!command) {
      return res.status(404).json({
        success: false,

        message:
          "Command not found",
      });
    }

    // --------------------------------------------------------
    // Verify authenticated device
    // --------------------------------------------------------

    const authenticatedDeviceId =
      normalizeDeviceId(
        req.device.deviceId
      );

    const commandDeviceId =
      normalizeDeviceId(
        command.deviceId
      );

    if (
      commandDeviceId !==
      authenticatedDeviceId
    ) {
      return res.status(403).json({
        success: false,

        message:
          "Device is not authorized for this command",
      });
    }

    // --------------------------------------------------------
    // Command must be SENT
    // --------------------------------------------------------

    if (
      command.status !==
      "SENT"
    ) {
      return res.status(400).json({
        success: false,

        message:
          `Command result cannot be updated from status ${command.status}`,
      });
    }

    // --------------------------------------------------------
    // Update command
    // --------------------------------------------------------

    const now =
      new Date();

    command.status =
      status;

    if (
      status ===
      "EXECUTED"
    ) {
      command.executedAt =
        now;

      command.failedAt =
        null;

      command.errorMessage =
        null;
    }

    if (
      status ===
      "FAILED"
    ) {
      command.failedAt =
        now;

      command.executedAt =
        null;

      command.errorMessage =
        errorMessage ||
        "Command execution failed";
    }

    await command.save();

    console.log("=================================");
    console.log("[COMMAND RESULT]");
    console.log(
      "Command ID :",
      command._id
    );
    console.log(
      "Command    :",
      command.command
    );
    console.log(
      "Source     :",
      command.source
    );
    console.log(
      "Mode       :",
      command.mode
    );
    console.log(
      "Status     :",
      command.status
    );
    console.log("=================================");

    // ========================================================
    // UPDATE SAME ACTIVITY
    // ========================================================

    try {
      const activityStatus =
        status === "EXECUTED"
          ? "SUCCESS"
          : "FAILED";

      const activityDescription =
        status === "EXECUTED"
          ? "ESP32 successfully executed the command."
          : errorMessage ||
            "ESP32 failed to execute the command.";

      const updateFields = {
        status:
          activityStatus,

        description:
          activityDescription,

        mode:
          command.mode,

        source:
          getActivitySource(
            command.source
          ),

        "metadata.commandStatus":
          status,

        "metadata.resultStatus":
          status,

        "metadata.completedAt":
          now,

        "metadata.mode":
          command.mode,

        "metadata.source":
          command.source,
      };

      if (
        status === "FAILED"
      ) {
        updateFields[
          "metadata.errorMessage"
        ] =
          errorMessage ||
          "Command execution failed";
      }

      const updatedActivity =
        await Activity.findOneAndUpdate(
          {
            commandId:
              command._id,
          },

          {
            $set:
              updateFields,
          },

          {
            new: true,
          }
        );

      if (
        updatedActivity
      ) {
        console.log(
          "[ACTIVITY RESULT UPDATED]"
        );

        console.log(
          "Activity ID :",
          updatedActivity._id
        );

        console.log(
          "Status      :",
          updatedActivity.status
        );

        console.log(
          "Mode        :",
          updatedActivity.mode
        );
      } else {
        console.warn(
          "[ACTIVITY NOT FOUND FOR COMMAND]",
          command._id
        );
      }
    } catch (activityError) {
      console.error(
        "[ACTIVITY RESULT UPDATE FAILED]",
        activityError.message
      );
    }

    // ========================================================
    // SOCKET.IO - COMMAND RESULT
    // ========================================================

    emitCommandUpdate({
      action:
        status,

      deviceId:
        authenticatedDeviceId,

      command:
        command.toObject(),
    });

    // ========================================================
    // SMS COMMAND → NOTIFICATION LOG
    // ========================================================

    let notification =
      null;

    if (
      command.command ===
      "SMS_SEND"
    ) {
      console.log("");

      console.log(
        `[SMS COMMAND RESULT] Command: ${command._id}`
      );

      console.log(
        `[SMS COMMAND RESULT] Status: ${status}`
      );

      // ------------------------------------------------------
      // Find notification by commandId
      // ------------------------------------------------------

      notification =
        await NotificationLog.findOne(
          {
            commandId:
              command._id,
          }
        );

      // ------------------------------------------------------
      // Fallback notificationId
      // ------------------------------------------------------

      if (
        !notification &&
        command.parameters
          ?.notificationId
      ) {
        notification =
          await NotificationLog.findById(
            command.parameters
              .notificationId
          );
      }

      // ------------------------------------------------------
      // Update notification
      // ------------------------------------------------------

      if (
        notification
      ) {
        if (
          status ===
          "EXECUTED"
        ) {
          notification.status =
            "SENT";

          notification.sentAt =
            now;

          notification.errorMessage =
            null;
        }

        if (
          status ===
          "FAILED"
        ) {
          notification.status =
            "FAILED";

          notification.sentAt =
            null;

          notification.errorMessage =
            errorMessage ||
            "SMS delivery failed on ESP32";
        }

        notification.commandId =
          command._id;

        await notification.save();

        console.log(
          `[SMS NOTIFICATION UPDATED] ${notification._id}`
        );

        console.log(
          `[SMS NOTIFICATION STATUS] ${notification.status}`
        );

        // ----------------------------------------------------
        // Socket notification update
        // ----------------------------------------------------

        emitNotificationUpdate({
          action:
            "UPDATED",

          deviceId:
            authenticatedDeviceId,

          notification:
            notification.toObject(),
        });
      } else {
        console.warn(
          `[SMS NOTIFICATION NOT FOUND] Command ${command._id}`
        );
      }
    }

    // ========================================================
    // SOCKET.IO - DASHBOARD REFRESH
    // ========================================================

    emitDashboardRefresh({
      reason:
        "COMMAND_RESULT",

      deviceId:
        authenticatedDeviceId,

      commandId:
        command._id,

      status,
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.json({
      success: true,

      message:
        "Command result updated",

      data: {
        command,

        notification:
          notification
            ? {
                id:
                  notification._id,

                status:
                  notification.status,

                sentAt:
                  notification.sentAt,

                errorMessage:
                  notification.errorMessage,
              }
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Update command result error:",
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to update command result",

      error:
        error.message,
    });
  }
}

// ============================================================
// GET /api/commands/:deviceId/history
// USER / ADMIN COMMAND HISTORY
// Requires normal JWT authentication
// ============================================================

async function getCommandHistory(
  req,
  res
) {
  try {
    const deviceId =
      normalizeDeviceId(
        req.params.deviceId
      );

    const limit =
      Math.min(
        Math.max(
          parseInt(
            req.query.limit,
            10
          ) || 50,
          1
        ),
        500
      );

    const commands =
      await Command.find({
        deviceId,
      })
        .sort({
          createdAt: -1,
        })
        .limit(limit)
        .lean();

    return res.json({
      success: true,

      count:
        commands.length,

      data:
        commands,
    });
  } catch (error) {
    console.error(
      "Command history error:",
      error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Failed to fetch command history",
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createCommand,
  getPendingCommands,
  markCommandSent,
  updateCommandResult,
  getCommandHistory,
};