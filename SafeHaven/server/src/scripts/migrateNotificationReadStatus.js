const connectDatabase = require("../config/db");
const NotificationLog = require("../models/NotificationLog");

async function migrateNotificationReadStatus() {
  try {
    await connectDatabase();

    const result =
      await NotificationLog.updateMany(
        {
          isRead: {
            $exists: false,
          },
        },
        {
          $set: {
            isRead: false,
          },
        }
      );

    console.log("");
    console.log("====================================");
    console.log(" NOTIFICATION READ STATUS MIGRATION");
    console.log("====================================");
    console.log(
      `Matched: ${result.matchedCount}`
    );
    console.log(
      `Modified: ${result.modifiedCount}`
    );
    console.log("====================================");
    console.log("");

    process.exit(0);
  } catch (error) {
    console.error(
      "Notification migration failed:",
      error
    );

    process.exit(1);
  }
}

migrateNotificationReadStatus();