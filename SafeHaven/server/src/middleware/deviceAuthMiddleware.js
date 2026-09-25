const crypto = require("crypto");
const Device = require("../models/Device");

function hashDeviceKey(deviceKey) {
  return crypto
    .createHash("sha256")
    .update(deviceKey)
    .digest("hex");
}

async function authenticateDevice(req, res, next) {
  try {
    const deviceId = req.header("X-Device-ID");
    const deviceKey = req.header("X-Device-Key");

    if (!deviceId || !deviceKey) {
      return res.status(401).json({
        success: false,
        message: "Device authentication required",
      });
    }

    const normalizedDeviceId = deviceId
      .trim()
      .toUpperCase();

    const device = await Device.findOne({
      deviceId: normalizedDeviceId,
      isActive: true,
    }).select("+deviceKeyHash");

    if (!device) {
      return res.status(401).json({
        success: false,
        message: "Invalid device",
      });
    }

    if (!device.deviceKeyHash) {
      return res.status(401).json({
        success: false,
        message: "Device authentication is not configured",
      });
    }

    const providedHash = hashDeviceKey(deviceKey);

    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedHash, "hex"),
      Buffer.from(device.deviceKeyHash, "hex")
    );

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid device credentials",
      });
    }

    req.device = device;

    next();
  } catch (error) {
    console.error(
      "Device authentication error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Device authentication failed",
    });
  }
}

module.exports = {
  authenticateDevice,
  hashDeviceKey,
};