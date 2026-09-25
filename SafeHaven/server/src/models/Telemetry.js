const mongoose = require("mongoose");

const telemetrySchema = new mongoose.Schema(
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
    // ENVIRONMENT SENSORS - PROCESSED VALUES
    // ============================================================
    temperature: {
      type: Number,
      default: null,
    },

    humidity: {
      type: Number,
      default: null,
    },

    // Normalized smoke level: 0-100
    // NOTE: This is NOT calibrated smoke concentration in ppm.
    smoke: {
      type: Number,
      default: null,
    },

    // Normalized gas level: 0-100
    // NOTE: This is NOT calibrated gas concentration in ppm.
    gas: {
      type: Number,
      default: null,
    },

    // Noise Index: 0-100
    // NOTE: This is NOT actual dB SPL unless calibrated.
    noise: {
      type: Number,
      default: null,
    },

    // Flame intensity/index: 0-100
    // NOTE: Actual meaning depends on flame sensor module calibration.
    fire: {
      type: Number,
      default: null,
    },

    // ============================================================
    // RAW SENSOR VALUES
    // ============================================================
    // ESP32 ADC raw values.
    // ESP32 ADC is configured for 12-bit resolution:
    // 0 - 4095
    //
    // These fields are useful for:
    // - debugging
    // - calibration
    // - future formula improvements
    // - sensor analysis
    // ============================================================

    smokeRaw: {
      type: Number,
      default: null,
    },

    gasRaw: {
      type: Number,
      default: null,
    },

    noiseRaw: {
      type: Number,
      default: null,
    },

    fireRaw: {
      type: Number,
      default: null,
    },

    // ============================================================
    // SAFETY PROCESSING
    // ============================================================
    safetyStatus: {
      type: String,
      enum: ["SAFE", "WARNING", "DANGER"],
      default: "SAFE",
      index: true,
    },

    safetyReason: {
      type: String,
      default: "Normal operating conditions",
      trim: true,
    },

    // ============================================================
    // ACTUATOR STATE
    // ============================================================
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

    // ============================================================
    // NETWORK
    // ============================================================
    wifiRSSI: {
      type: Number,
      default: null,
    },

    // ============================================================
    // TIMESTAMP
    // ============================================================
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },

  {
    timestamps: true,

    // Exact MongoDB collection name
    collection: "telemetry",
  }
);

// ============================================================
// INDEXES
// ============================================================

telemetrySchema.index({
  deviceId: 1,
  timestamp: -1,
});

telemetrySchema.index({
  deviceId: 1,
  safetyStatus: 1,
  timestamp: -1,
});

module.exports = mongoose.model("Telemetry", telemetrySchema);