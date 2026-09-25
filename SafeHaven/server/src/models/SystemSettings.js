const mongoose = require("mongoose");

// =====================================================
// THRESHOLD SCHEMA
// =====================================================

const thresholdSchema = new mongoose.Schema(
  {
    warning: {
      type: Number,
      required: true,
      min: 0,
    },

    danger: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// SYSTEM SETTINGS SCHEMA
// =====================================================

const systemSettingsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "SafeHaven System Settings",
      trim: true,
    },

    // ===================================================
    // MONITORING
    // ===================================================

    monitoring: {
      telemetryIntervalSeconds: {
        type: Number,
        default: 2,
        min: 1,
      },

      apiIntervalSeconds: {
        type: Number,
        default: 5,
        min: 1,
      },

      offlineTimeoutSeconds: {
        type: Number,
        default: 30,
        min: 5,
      },
    },

    // ===================================================
    // SENSOR THRESHOLDS
    // ===================================================

    thresholds: {
      temperature: {
        type: thresholdSchema,

        default: () => ({
          warning: 40,
          danger: 45,
          unit: "°C",
        }),
      },

      humidity: {
        type: thresholdSchema,

        default: () => ({
          warning: 60,
          danger: 80,
          unit: "%",
        }),
      },

      smoke: {
        type: thresholdSchema,

        default: () => ({
          warning: 40,
          danger: 70,
          unit: "%",
        }),
      },

      gas: {
        type: thresholdSchema,

        default: () => ({
          warning: 40,
          danger: 70,
          unit: "%",
        }),
      },

      noise: {
        type: thresholdSchema,

        default: () => ({
          warning: 50,
          danger: 80,
          unit: "Index",
        }),
      },

      fire: {
        type: thresholdSchema,

        default: () => ({
          warning: 50,
          danger: 70,
          unit: "%",
        }),
      },
    },

    // ===================================================
    // SMS SETTINGS
    // ===================================================

    sms: {
      enabled: {
        type: Boolean,
        default: true,
      },

      phoneNumbers: {
        type: [String],
        default: [],
      },

      warningMessage: {
        type: String,

        default:
          "SafeHaven WARNING: {sensorTitle}. {sensor} value is {value}{unit}, threshold is {threshold}{unit}. Please check the system.",

        trim: true,
        maxlength: 1000,
      },

      dangerMessage: {
        type: String,

        default:
          "SafeHaven DANGER: {sensorTitle}. {sensor} value is {value}{unit}, threshold is {threshold}{unit}. Immediate attention required.",

        trim: true,
        maxlength: 1000,
      },

      cooldownSeconds: {
        type: Number,
        default: 60,
        min: 0,
      },
    },

    // ===================================================
    // AUTOMATION
    // ===================================================

    automation: {
      enabled: {
        type: Boolean,
        default: true,
      },

      manualOverride: {
        type: Boolean,
        default: true,
      },

      firePump: {
        type: Boolean,
        default: true,
      },

      gasExhaust: {
        type: Boolean,
        default: true,
      },

      dangerBuzzer: {
        type: Boolean,
        default: true,
      },
    },

    // ===================================================
    // NOTIFICATIONS
    // ===================================================

    notifications: {
      browser: {
        type: Boolean,
        default: true,
      },

      sms: {
        type: Boolean,
        default: true,
      },

      dangerOnly: {
        type: Boolean,
        default: false,
      },
    },

    // ===================================================
    // UPDATED BY
    // ===================================================

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,

      ref: "User",

      default: null,
    },
  },

  {
    timestamps: true,

    collection: "system_settings",
  }
);

// =====================================================
// EXPORT MONGOOSE MODEL
// =====================================================

const SystemSettings =
  mongoose.model(
    "SystemSettings",
    systemSettingsSchema
  );

module.exports = SystemSettings;