const crypto = require("crypto");

const connectDatabase = require("../config/db");
const Device = require("../models/Device");

async function provisionDevice() {
  try {
    await connectDatabase();

    const deviceId = "SAFEHAVEN-001";

    // Generate a new 256-bit secret
    const deviceKey = crypto.randomBytes(32).toString("hex");

    // Store only SHA-256 hash in MongoDB
    const deviceKeyHash = crypto
      .createHash("sha256")
      .update(deviceKey)
      .digest("hex");

    const device = await Device.findOne({
      deviceId,
    });

    if (!device) {
      throw new Error(
        `Device ${deviceId} not found in hardware_units`
      );
    }

    device.deviceKeyHash = deviceKeyHash;

    await device.save();

    console.log("");
    console.log("====================================");
    console.log("   SAFEHAVEN DEVICE PROVISIONING");
    console.log("====================================");
    console.log("");
    console.log(`Device ID: ${deviceId}`);
    console.log("");
    console.log("DEVICE KEY:");
    console.log(deviceKey);
    console.log("");
    console.log("IMPORTANT:");
    console.log("Save this key securely.");
    console.log("It will NOT be shown again.");
    console.log("");
    console.log("MongoDB stores only the SHA-256 hash.");
    console.log("");
    console.log("====================================");
    console.log("       PROVISIONING SUCCESS");
    console.log("====================================");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("Device provisioning failed:");
    console.error(error.message);
    console.error("");
    process.exitCode = 1;
  } finally {
    process.exit();
  }
}

provisionDevice();