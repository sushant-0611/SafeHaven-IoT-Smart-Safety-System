const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    // ============================================================
    // DEVICE
    // ============================================================
    deviceId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ============================================================
    // USER
    // ============================================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ============================================================
    // ACTIVITY TYPE
    // ============================================================
    type: {
      type: String,
      enum: [
        "MODE_CHANGE",
        "COMMAND",
        "AUTOMATION",
        "SYSTEM",
        "ALERT",
      ],
      required: true,
      index: true,
    },

    // ============================================================
    // ACTION
    // ============================================================
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // ============================================================
    // UI TITLE
    // ============================================================
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // DESCRIPTION
    // ============================================================
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // ============================================================
    // ACTIVITY STATUS
    // ============================================================
    status: {
      type: String,
      enum: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "INFO",
      ],
      default: "INFO",
      index: true,
    },

    // ============================================================
    // RELATED COMMAND
    // ============================================================
    commandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Command",
      default: null,
      index: true,
    },

    // ============================================================
    // MODE
    // ============================================================
    mode: {
      type: String,
      enum: ["AUTO", "MANUAL", null],
      default: null,
      index: true,
    },

    // ============================================================
    // SOURCE
    // ============================================================
    source: {
      type: String,
      enum: [
        "USER",
        "MANUAL",
        "AUTOMATION",
        "SYSTEM",
        "ESP32",
      ],
      default: "SYSTEM",
      index: true,
    },

    // ============================================================
    // EXTRA INFORMATION
    // ============================================================
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ============================================================
    // EVENT TIME
    // ============================================================
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "activities",
  }
);

// ============================================================
// INDEXES
// ============================================================

activitySchema.index({
  deviceId: 1,
  timestamp: -1,
});

activitySchema.index({
  deviceId: 1,
  type: 1,
  timestamp: -1,
});

activitySchema.index({
  userId: 1,
  timestamp: -1,
});

module.exports = mongoose.model(
  "Activity",
  activitySchema
);