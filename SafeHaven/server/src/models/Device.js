const mongoose = require("mongoose");

const hardwareUnitSchema = new mongoose.Schema(
  {
    // ============================================================
    // BASIC DEVICE INFORMATION
    // ============================================================

    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    deviceKeyHash: {
      type: String,
      required: true,
      select: false,
    },

    name: {
      type: String,
      default: "SafeHaven Hardware Unit",
      trim: true,
    },

    location: {
      type: String,
      default: "Not specified",
      trim: true,
    },

    // ============================================================
    // DEVICE STATUS
    // ============================================================

    status: {
      type: String,
      enum: ["ONLINE", "OFFLINE"],
      default: "OFFLINE",
      index: true,
    },

    lastSeen: {
      type: Date,
      default: null,
      index: true,
    },

    // ============================================================
    // FIRMWARE
    // ============================================================

    firmwareVersion: {
      type: String,
      default: "1.0.0",
      trim: true,
    },

    // ============================================================
    // HARDWARE CONFIGURATION
    // ============================================================

    hardware: {
      controller: {
        type: String,
        default: "ESP32",
      },

      sensors: {
        dht11: {
          type: Boolean,
          default: true,
        },

        mq2: {
          type: Boolean,
          default: true,
        },

        mq6: {
          type: Boolean,
          default: true,
        },

        flame: {
          type: Boolean,
          default: true,
        },

        sound: {
          type: Boolean,
          default: true,
        },
      },

      actuators: {
        pump: {
          type: Boolean,
          default: true,
        },

        fan: {
          type: Boolean,
          default: true,
        },

        buzzer: {
          type: Boolean,
          default: true,
        },

        redLed: {
          type: Boolean,
          default: true,
        },

        greenLed: {
          type: Boolean,
          default: true,
        },
      },

      gsm: {
        type: Boolean,
        default: true,
      },

      lcd: {
        type: Boolean,
        default: true,
      },
    },

    // ============================================================
    // NETWORK INFORMATION
    // ============================================================

    network: {
      wifiRSSI: {
        type: Number,
        default: null,
      },

      ipAddress: {
        type: String,
        default: null,
        trim: true,
      },
    },

    // ============================================================
    // CURRENT ACTUATOR STATE
    // ============================================================

    actuators: {
      pump: {
        type: Boolean,
        default: false,
      },

      fan: {
        type: Boolean,
        default: false,
      },

      buzzer: {
        type: Boolean,
        default: false,
      },

      redLed: {
        type: Boolean,
        default: false,
      },

      greenLed: {
        type: Boolean,
        default: false,
      },
    },

    // ============================================================
    // DEVICE METADATA
    // ============================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },

  {
    timestamps: true,

    // Force exact MongoDB collection name
    collection: "hardware_units",
  }
);

module.exports = mongoose.model("Device", hardwareUnitSchema);