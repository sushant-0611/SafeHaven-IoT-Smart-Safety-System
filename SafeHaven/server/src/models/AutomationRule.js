const mongoose = require("mongoose");

const automationRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    deviceId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
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
    },

    operator: {
      type: String,
      required: true,
      enum: [
        ">",
        ">=",
        "<",
        "<=",
        "==",
      ],
    },

    threshold: {
      type: Number,
      required: true,
    },

    severity: {
      type: String,
      enum: [
        "WARNING",
        "DANGER",
        "CRITICAL",
      ],
      default: "WARNING",
    },

    actions: [
      {
        type: String,
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
        ],
      },
    ],

    sendSMS: {
      type: Boolean,
      default: false,
    },

    createAlert: {
      type: Boolean,
      default: true,
    },

    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },

    priority: {
      type: Number,
      default: 100,
    },
  },
  {
    timestamps: true,
    collection: "automation_rules",
  }
);

automationRuleSchema.index({
  deviceId: 1,
  enabled: 1,
});

module.exports = mongoose.model(
  "AutomationRule",
  automationRuleSchema
);