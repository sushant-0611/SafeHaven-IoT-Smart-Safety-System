const mongoose = require("mongoose");

const commandSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    command: {
      type: String,
      required: true,
      enum: [
        "PUMP_ON",
        "PUMP_OFF",
        "FAN_ON",
        "FAN_OFF",
        "BUZZER_ON",
        "BUZZER_OFF",
        "RED_LED_ON",
        "RED_LED_OFF",
        "GREEN_LED_ON",
        "GREEN_LED_OFF",
        "ALL_ACTUATORS_OFF",
        "SMS_SEND",
      ],
      index: true,
    },

    source: {
      type: String,
      enum: [
        "AUTOMATION",
        "MANUAL",
        "SYSTEM",
      ],
      default: "SYSTEM",
    },
    
      mode: {
        type: String,
        enum: ["AUTO", "MANUAL", null],
        default: null,
        index: true,
      },

    status: {
      type: String,
      enum: [
        "PENDING",
        "SENT",
        "EXECUTED",
        "FAILED",
        "EXPIRED",
      ],
      default: "PENDING",
      index: true,
    },

    priority: {
      type: String,
      enum: [
        "LOW",
        "NORMAL",
        "HIGH",
        "CRITICAL",
      ],
      default: "NORMAL",
    },

    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    reason: {
      type: String,
      default: null,
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    sentAt: {
      type: Date,
      default: null,
    },

    executedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "commands",
  }
);

commandSchema.index({
  deviceId: 1,
  status: 1,
  createdAt: 1,
});

module.exports = mongoose.model("Command", commandSchema);