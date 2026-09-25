const Device = require("../models/Device");
const DeviceEvent = require("../models/DeviceEvent");
const SystemSettings = require("../models/SystemSettings");

const {
  emitDeviceStatusUpdate,
  emitSystemUpdate,
} = require("./socketService");

/**
 * Create and store a device event.
 *
 * Also emits the event in real time through Socket.IO.
 */
async function createDeviceEvent({
  deviceId,
  eventType,
  message,
  metadata = {},
}) {
  try {
    const normalizedDeviceId = String(deviceId)
      .trim()
      .toUpperCase();

    const deviceEvent = await DeviceEvent.create({
      deviceId: normalizedDeviceId,
      eventType,
      message,
      metadata,
      occurredAt: new Date(),
    });

    console.log(
      `[DEVICE EVENT] ${eventType} | ${normalizedDeviceId} | ${message}`
    );

    // ---------------------------------------------------------
    // REAL-TIME SOCKET.IO EVENT
    // ---------------------------------------------------------
    emitSystemUpdate({
      type: "DEVICE_EVENT",
      event: deviceEvent.toObject(),
    });

    return deviceEvent;
  } catch (error) {
    console.error(
      `[DEVICE EVENT ERROR] ${deviceId}:`,
      error.message
    );

    return null;
  }
}

/**
 * Called whenever authenticated telemetry is received.
 *
 * Device state behavior:
 *
 * 1. First-ever telemetry
 *    lastSeen = null
 *    -> ONLINE
 *    -> ONLINE event
 *
 * 2. Device already ONLINE
 *    -> update lastSeen
 *    -> NO duplicate ONLINE event
 *
 * 3. Device was OFFLINE and sends telemetry again
 *    lastSeen exists + status OFFLINE
 *    -> ONLINE
 *    -> RECONNECTED event
 */
async function markDeviceOnline(deviceId, metadata = {}) {
  const normalizedDeviceId = String(deviceId)
    .trim()
    .toUpperCase();

  const device = await Device.findOne({
    deviceId: normalizedDeviceId,
    isActive: true,
  });

  if (!device) {
    throw new Error(
      `Active device ${normalizedDeviceId} not found`
    );
  }

  // ---------------------------------------------------------
  // CAPTURE STATE BEFORE CHANGING IT
  // ---------------------------------------------------------
  const wasOffline = device.status === "OFFLINE";
  const wasNeverConnected = !device.lastSeen;

  // ---------------------------------------------------------
  // UPDATE DEVICE STATE
  // ---------------------------------------------------------
  device.status = "ONLINE";
  device.lastSeen = new Date();

  // Firmware version
  if (
    metadata.firmwareVersion !== undefined &&
    metadata.firmwareVersion !== null &&
    metadata.firmwareVersion !== ""
  ) {
    device.firmwareVersion = metadata.firmwareVersion;
  }

  // Wi-Fi RSSI
  if (
    metadata.wifiRSSI !== undefined &&
    metadata.wifiRSSI !== null
  ) {
    device.network.wifiRSSI = Number(metadata.wifiRSSI);
  }

  // IP address
  if (
    metadata.ipAddress !== undefined &&
    metadata.ipAddress !== null &&
    metadata.ipAddress !== ""
  ) {
    device.network.ipAddress = metadata.ipAddress;
  }

  await device.save();

  // ---------------------------------------------------------
  // REAL-TIME DEVICE STATUS UPDATE
  // ---------------------------------------------------------
  emitDeviceStatusUpdate({
    deviceId: normalizedDeviceId,
    status: "ONLINE",
    lastSeen: device.lastSeen,
    firmwareVersion: device.firmwareVersion,
    network: {
      wifiRSSI: device.network?.wifiRSSI ?? null,
      ipAddress: device.network?.ipAddress ?? null,
    },
    previousStatus: wasOffline ? "OFFLINE" : null,
    eventType: wasNeverConnected
      ? "ONLINE"
      : wasOffline
      ? "RECONNECTED"
      : "TELEMETRY_RECEIVED",
  });

  // ---------------------------------------------------------
  // EVENT LOGIC
  // ---------------------------------------------------------

  // First-ever connection
  if (wasNeverConnected) {
    await createDeviceEvent({
      deviceId: normalizedDeviceId,
      eventType: "ONLINE",
      message:
        "SafeHaven device connected successfully.",
      metadata: {
        ...metadata,
        source: "device-status-service",
      },
    });
  }

  // Previously connected device reconnecting
  else if (wasOffline) {
    await createDeviceEvent({
      deviceId: normalizedDeviceId,
      eventType: "RECONNECTED",
      message:
        "SafeHaven device reconnected successfully.",
      metadata: {
        ...metadata,
        source: "device-status-service",
      },
    });
  }

  // Already ONLINE
  // No ONLINE/RECONNECTED event.

  return {
    device,
    wasOffline,
    wasNeverConnected,
    status: "ONLINE",
    lastSeen: device.lastSeen,
  };
}

/**
 * Checks all active devices and marks stale devices OFFLINE.
 *
 * Offline timeout comes from:
 * system_settings.monitoring.offlineTimeoutSeconds
 *
 * When a device becomes OFFLINE:
 * 1. Device status is updated
 * 2. OFFLINE event is created
 * 3. Socket.IO device:status event is emitted
 */
async function checkOfflineDevices() {
  try {
    const settings = await SystemSettings.findOne().lean();

    const timeoutSeconds =
      settings?.monitoring?.offlineTimeoutSeconds || 30;

    const cutoffTime = new Date(
      Date.now() - timeoutSeconds * 1000
    );

    const devices = await Device.find({
      isActive: true,
      status: "ONLINE",
    });

    let markedOffline = 0;

    for (const device of devices) {
      // Device has never sent telemetry.
      if (!device.lastSeen) {
        continue;
      }

      // Device has not sent telemetry within timeout.
      if (device.lastSeen < cutoffTime) {
        const previousLastSeen = device.lastSeen;

        device.status = "OFFLINE";

        await device.save();

        // -----------------------------------------------------
        // REAL-TIME OFFLINE STATUS UPDATE
        // -----------------------------------------------------
        emitDeviceStatusUpdate({
          deviceId: device.deviceId,
          status: "OFFLINE",
          lastSeen: previousLastSeen,
          previousStatus: "ONLINE",
          eventType: "OFFLINE",
          timeoutSeconds,
        });

        // -----------------------------------------------------
        // CREATE OFFLINE EVENT
        // -----------------------------------------------------
        await createDeviceEvent({
          deviceId: device.deviceId,
          eventType: "OFFLINE",
          message:
            `SafeHaven device has not sent telemetry for more than ${timeoutSeconds} seconds.`,
          metadata: {
            lastSeen: previousLastSeen,
            timeoutSeconds,
            source: "offline-monitor",
          },
        });

        markedOffline++;

        console.log(
          `[DEVICE OFFLINE] ${device.deviceId} | Last seen: ${previousLastSeen.toISOString()}`
        );
      }
    }

    // ---------------------------------------------------------
    // REAL-TIME SYSTEM UPDATE
    // ---------------------------------------------------------
    if (markedOffline > 0) {
      emitSystemUpdate({
        type: "OFFLINE_DEVICES_DETECTED",
        markedOffline,
        checked: devices.length,
        timeoutSeconds,
      });
    }

    return {
      checked: devices.length,
      markedOffline,
      timeoutSeconds,
    };
  } catch (error) {
    console.error(
      "[OFFLINE MONITOR ERROR]:",
      error.message
    );

    return {
      checked: 0,
      markedOffline: 0,
      error: error.message,
    };
  }
}

module.exports = {
  markDeviceOnline,
  checkOfflineDevices,
  createDeviceEvent,
};