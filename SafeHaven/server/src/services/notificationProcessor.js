const NotificationLog = require("../models/NotificationLog");
const {
  createSMSCommandForNotification,
} = require("./smsService");

let processorInterval = null;
let isProcessing = false;

const PROCESS_INTERVAL_MS = 5000;
const BATCH_SIZE = 10;

// ============================================================
// PROCESS ONE NOTIFICATION
// ============================================================

async function processNotification(log) {
  try {
    console.log("");
    console.log(
      `[NOTIFICATION PROCESSOR] Processing ${log._id}`
    );

    console.log(
      `[NOTIFICATION PROCESSOR] Type: ${log.type}`
    );

    console.log(
      `[NOTIFICATION PROCESSOR] Recipient: ${log.recipient}`
    );

    // ========================================================
    // SMS
    // ========================================================

    if (log.type === "SMS") {
      // ------------------------------------------------------
      // If command already exists, do not create another one.
      // ------------------------------------------------------

      if (log.commandId) {
        console.log(
          `[NOTIFICATION PROCESSOR] SMS command already linked: ${log.commandId}`
        );

        return {
          success: false,
          retryable: true,
          reason:
            "SMS command already created. Waiting for ESP32 execution.",
          commandCreated: false,
          commandId: log.commandId,
        };
      }

      // ------------------------------------------------------
      // Create SMS_SEND command
      // ------------------------------------------------------

      console.log(
        `[NOTIFICATION PROCESSOR] Creating SMS_SEND command for ${log._id}`
      );

      const commandResult =
        await createSMSCommandForNotification(log);

      // ------------------------------------------------------
      // Duplicate command was already found
      // ------------------------------------------------------

      if (commandResult.duplicate) {
        console.log(
          `[NOTIFICATION PROCESSOR] Existing SMS command found: ${commandResult.command._id}`
        );

        return {
          success: false,
          retryable: true,
          reason:
            "SMS command already exists. Waiting for ESP32 execution.",
          commandCreated: false,
          duplicate: true,
          commandId:
            commandResult.command._id,
        };
      }

      // ------------------------------------------------------
      // New command created
      // ------------------------------------------------------

      if (commandResult.created) {
        console.log(
          `[SMS COMMAND CREATED] Notification: ${log._id} | Command: ${commandResult.command._id}`
        );

        return {
          success: false,
          retryable: true,
          reason:
            "SMS_SEND command created. Waiting for ESP32 execution.",
          commandCreated: true,
          commandId:
            commandResult.command._id,
        };
      }

      // ------------------------------------------------------
      // Unexpected result
      // ------------------------------------------------------

      return {
        success: false,
        retryable: true,
        reason:
          "SMS command creation returned an unexpected result.",
      };
    }

    // ========================================================
    // BROWSER
    // ========================================================

    if (log.type === "BROWSER") {
      return {
        success: false,
        retryable: true,
        reason:
          "Browser notification transport is not implemented yet.",
      };
    }

    // ========================================================
    // SYSTEM
    // ========================================================

    if (log.type === "SYSTEM") {
      return {
        success: true,
        retryable: false,
        reason:
          "System notification processed.",
      };
    }

    // ========================================================
    // UNSUPPORTED TYPE
    // ========================================================

    return {
      success: false,
      retryable: false,
      reason:
        `Unsupported notification type: ${log.type}`,
    };
  } catch (error) {
    console.error(
      `[NOTIFICATION PROCESSOR ERROR] ${log._id}:`,
      error.message
    );

    return {
      success: false,
      retryable: true,
      reason: error.message,
    };
  }
}

// ============================================================
// FETCH AND PROCESS PENDING NOTIFICATIONS
// ============================================================

async function processPendingNotifications() {
  if (isProcessing) {
    console.log(
      "[NOTIFICATION PROCESSOR] Previous cycle still running. Skipping."
    );

    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: true,
    };
  }

  isProcessing = true;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // --------------------------------------------------------
    // Get oldest pending notifications first
    // --------------------------------------------------------

    const pendingLogs =
      await NotificationLog.find({
        status: "PENDING",
      })
        .sort({
          createdAt: 1,
        })
        .limit(BATCH_SIZE);

    // --------------------------------------------------------
    // No pending notifications
    // --------------------------------------------------------

    if (pendingLogs.length === 0) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
      };
    }

    console.log(
      `[NOTIFICATION PROCESSOR] Found ${pendingLogs.length} pending notification(s).`
    );

    // --------------------------------------------------------
    // Process each notification
    // --------------------------------------------------------

    for (const log of pendingLogs) {
      const result =
        await processNotification(log);

      processed++;

      // ======================================================
      // SUCCESS
      // ======================================================

      if (result.success) {
        await NotificationLog.findByIdAndUpdate(
          log._id,
          {
            $set: {
              status: "SENT",
              sentAt: new Date(),
              errorMessage: null,
            },
          }
        );

        succeeded++;

        console.log(
          `[NOTIFICATION SENT] ${log._id}`
        );

        continue;
      }

      // ======================================================
      // RETRYABLE
      // ======================================================

      if (result.retryable) {
        /*
         * IMPORTANT:
         *
         * For SMS, PENDING is intentional.
         *
         * The notification is NOT considered sent merely
         * because an SMS_SEND command was created.
         *
         * Actual status will be updated after ESP32/SIM800C
         * reports the execution result.
         */

        await NotificationLog.findByIdAndUpdate(
          log._id,
          {
            $set: {
              status: "PENDING",
              errorMessage: result.reason,
            },
          }
        );

        console.log(
          `[NOTIFICATION PENDING] ${log._id} | ${result.reason}`
        );

        continue;
      }

      // ======================================================
      // NON-RETRYABLE FAILURE
      // ======================================================

      await NotificationLog.findByIdAndUpdate(
        log._id,
        {
          $set: {
            status: "FAILED",
            errorMessage: result.reason,
          },
        }
      );

      failed++;

      console.log(
        `[NOTIFICATION FAILED] ${log._id} | ${result.reason}`
      );
    }

    return {
      processed,
      succeeded,
      failed,
    };
  } catch (error) {
    console.error(
      "[NOTIFICATION PROCESSOR ERROR]:",
      error.message
    );

    return {
      processed,
      succeeded,
      failed,
      error: error.message,
    };
  } finally {
    isProcessing = false;
  }
}

// ============================================================
// START BACKGROUND NOTIFICATION PROCESSOR
// ============================================================

function startNotificationProcessor() {
  if (processorInterval) {
    console.log(
      "[NOTIFICATION PROCESSOR] Already running."
    );

    return;
  }

  console.log(
    "[NOTIFICATION PROCESSOR] Starting..."
  );

  processorInterval = setInterval(
    async () => {
      try {
        const result =
          await processPendingNotifications();

        if (result.processed > 0) {
          console.log(
            `[NOTIFICATION PROCESSOR] Processed: ${result.processed} | Success: ${result.succeeded} | Failed: ${result.failed}`
          );
        }
      } catch (error) {
        console.error(
          "[NOTIFICATION PROCESSOR] Unexpected error:",
          error.message
        );
      }
    },
    PROCESS_INTERVAL_MS
  );

  console.log(
    `[NOTIFICATION PROCESSOR] Interval: ${PROCESS_INTERVAL_MS / 1000} seconds`
  );
}

// ============================================================
// STOP BACKGROUND NOTIFICATION PROCESSOR
// ============================================================

function stopNotificationProcessor() {
  if (!processorInterval) {
    return;
  }

  clearInterval(processorInterval);

  processorInterval = null;

  console.log(
    "[NOTIFICATION PROCESSOR] Stopped."
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  processNotification,
  processPendingNotifications,
  startNotificationProcessor,
  stopNotificationProcessor,
};