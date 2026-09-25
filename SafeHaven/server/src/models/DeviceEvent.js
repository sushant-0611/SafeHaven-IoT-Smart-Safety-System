const mongoose = require("mongoose");

const deviceEventSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        "ONLINE",
        "OFFLINE",
        "RECONNECTED",
        "BOOT",
        "WIFI_CONNECTED",
        "WIFI_DISCONNECTED",
        "COMMAND_FAILED",
        "SENSOR_ERROR",
        "GSM_ERROR",
        "SYSTEM_ERROR",
      ],
      index: true,
    },

    message: {
      type: String,
      required: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "device_events",
  }
);

deviceEventSchema.index({
  deviceId: 1,
  occurredAt: -1,
});

module.exports = mongoose.model(
  "DeviceEvent",
  deviceEventSchema
);