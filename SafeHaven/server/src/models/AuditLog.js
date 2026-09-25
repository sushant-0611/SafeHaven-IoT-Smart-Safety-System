const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    deviceId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: [
        "AUTH",
        "DEVICE",
        "COMMAND",
        "SETTINGS",
        "ALERT",
        "SYSTEM",
      ],
      default: "SYSTEM",
    },

    description: {
      type: String,
      required: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "audit_logs",
  }
);

auditLogSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model(
  "AuditLog",
  auditLogSchema
);