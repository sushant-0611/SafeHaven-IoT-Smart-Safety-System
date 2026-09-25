const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    sensor: {
      type: String,
      required: true,
      enum: [
        "temperature",
        "humidity",
        "smoke",
        "gas",
        "noise",
        "fire",
      ],
      index: true,
    },

    severity: {
      type: String,
      required: true,
      enum: ["WARNING", "DANGER"],
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    source: {
      type: String,
      required: true,
      trim: true,
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    unit: {
      type: String,
      default: "%",
      trim: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
      default: "ACTIVE",
      index: true,
    },

    recordId: {
      type: String,
      default: null,
      index: true,
    },

    triggeredAt: {
      type: Date,
      required: true,
      index: true,
    },

    acknowledgedAt: {
      type: Date,
      default: null,
    },

    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    resolutionNote: {
      type: String,
      default: null,
      trim: true,
    },

    lastSeenAt: {
      type: Date,
      default: null,
    },

    lastValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "alerts",
  }
);

/*
 * Fast device history lookup.
 */
alertSchema.index({
  deviceId: 1,
  triggeredAt: -1,
});

/*
 * Dashboard counters.
 */
alertSchema.index({
  deviceId: 1,
  status: 1,
  severity: 1,
});

/*
 * Used to identify an alert occurrence.
 */
alertSchema.index({
  deviceId: 1,
  sensor: 1,
  recordId: 1,
});

module.exports = mongoose.model("Alert", alertSchema);