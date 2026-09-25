const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "SMS",
        "BROWSER",
        "SYSTEM",
      ],
      required: true,
      index: true,
    },

    recipient: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "SENT",
        "FAILED",
      ],
      default: "PENDING",
      index: true,
    },

    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Alert",
      default: null,
      index: true,
    },

    errorMessage: {
      type: String,
      default: null,
      trim: true,
    },

    commandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Command",
      default: null,
    },

    // ------------------------------------
    // Read / Unread status
    // ------------------------------------

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "notification_logs",
  }
);

// ------------------------------------
// Indexes
// ------------------------------------

notificationLogSchema.index({
  deviceId: 1,
  createdAt: -1,
});

notificationLogSchema.index({
  deviceId: 1,
  isRead: 1,
  createdAt: -1,
});

notificationLogSchema.index({
  type: 1,
  status: 1,
  createdAt: -1,
});

notificationLogSchema.index({
  alertId: 1,
  type: 1,
});

notificationLogSchema.index({
  commandId: 1,
});

module.exports = mongoose.model(
  "NotificationLog",
  notificationLogSchema
);