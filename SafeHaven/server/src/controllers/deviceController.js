const Device = require("../models/Device");
const SystemSettings = require("../models/SystemSettings");

// ============================================================
// HELPER
// Normalize device ID
// ============================================================

function normalizeDeviceId(deviceId) {
  return String(deviceId || "")
    .trim()
    .toUpperCase();
}

// ============================================================
// HELPER
// Calculate seconds since last seen
// ============================================================

function getSecondsSinceLastSeen(lastSeen) {
  if (!lastSeen) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(lastSeen).getTime()) /
        1000
    )
  );
}

// ============================================================
// HELPER
// Get offline timeout from system settings
// ============================================================

async function getOfflineTimeoutSeconds() {
  const settings =
    await SystemSettings.findOne().lean();

  return (
    settings?.monitoring
      ?.offlineTimeoutSeconds || 30
  );
}

// ============================================================
// HELPER
// Format device for dashboard
// ============================================================

function formatDeviceForDashboard(
  device,
  offlineTimeoutSeconds
) {
  const secondsSinceLastSeen =
    getSecondsSinceLastSeen(
      device.lastSeen
    );

  return {
    id: device._id,

    deviceId: device.deviceId,

    name: device.name,

    location: device.location,

    status: device.status,

    lastSeen: device.lastSeen,

    secondsSinceLastSeen,

    offlineTimeoutSeconds,

    firmwareVersion:
      device.firmwareVersion,

    network: {
      wifiRSSI:
        device.network?.wifiRSSI ?? null,

      ipAddress:
        device.network?.ipAddress ?? null,
    },

    actuators: {
      pump:
        device.actuators?.pump ?? false,

      fan:
        device.actuators?.fan ?? false,

      buzzer:
        device.actuators?.buzzer ?? false,

      redLed:
        device.actuators?.redLed ?? false,

      greenLed:
        device.actuators?.greenLed ?? false,
    },

    hardware: {
      controller:
        device.hardware?.controller ||
        "ESP32",

      sensors:
        device.hardware?.sensors || {},

      actuators:
        device.hardware?.actuators || {},

      gsm:
        device.hardware?.gsm ?? false,

      lcd:
        device.hardware?.lcd ?? false,
    },

    isActive:
      device.isActive,

    createdAt:
      device.createdAt,

    updatedAt:
      device.updatedAt,
  };
}

// ============================================================
// GET /api/devices
//
// Dashboard device list
//
// Query:
// ?status=ONLINE
// ?status=OFFLINE
// ?active=true
// ?active=false
// ?page=1
// ?limit=20
// ============================================================

async function getDevices(req, res) {
  try {
    const {
      status,
      active,
      page,
      limit,
    } = req.query;

    const query = {};

    // --------------------------------------------------------
    // Status filter
    // --------------------------------------------------------

    if (status) {
      const normalizedStatus =
        String(status)
          .trim()
          .toUpperCase();

      const allowedStatuses = [
        "ONLINE",
        "OFFLINE",
      ];

      if (
        !allowedStatuses.includes(
          normalizedStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be ONLINE or OFFLINE",
        });
      }

      query.status =
        normalizedStatus;
    }

    // --------------------------------------------------------
    // Active filter
    // --------------------------------------------------------

    if (
      typeof active !== "undefined"
    ) {
      const normalizedActive =
        String(active)
          .trim()
          .toLowerCase();

      if (
        normalizedActive !== "true" &&
        normalizedActive !== "false"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "active must be true or false",
        });
      }

      query.isActive =
        normalizedActive === "true";
    } else {
      // Dashboard normally shows
      // active devices only.
      query.isActive = true;
    }

    // --------------------------------------------------------
    // Pagination
    // --------------------------------------------------------

    const parsedPage = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const parsedLimit = Math.min(
      Math.max(
        parseInt(limit, 10) || 20,
        1
      ),
      100
    );

    const skip =
      (parsedPage - 1) *
      parsedLimit;

    // --------------------------------------------------------
    // Settings
    // --------------------------------------------------------

    const offlineTimeoutSeconds =
      await getOfflineTimeoutSeconds();

    // --------------------------------------------------------
    // Count
    // --------------------------------------------------------

    const total =
      await Device.countDocuments(query);

    const totalPages =
      Math.ceil(
        total / parsedLimit
      );

    // --------------------------------------------------------
    // Fetch devices
    // --------------------------------------------------------

    const devices =
      await Device.find(query)
        .sort({
          status: -1,
          lastSeen: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(parsedLimit)
        .lean();

    const data = devices.map(
      (device) =>
        formatDeviceForDashboard(
          device,
          offlineTimeoutSeconds
        )
    );

    return res.json({
      success: true,

      count: data.length,

      pagination: {
        page: parsedPage,

        limit: parsedLimit,

        total,

        totalPages,

        hasNextPage:
          parsedPage < totalPages,

        hasPreviousPage:
          parsedPage > 1,
      },

      filters: {
        status:
          status
            ? String(status)
                .trim()
                .toUpperCase()
            : null,

        active:
          typeof active !== "undefined"
            ? String(active)
                .trim()
                .toLowerCase() ===
              "true"
            : true,
      },

      data,
    });
  } catch (error) {
    console.error(
      "Get devices error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch devices",
      error: error.message,
    });
  }
}

// ============================================================
// GET /api/devices/:deviceId
//
// Dashboard device details
// ============================================================

async function getDeviceById(
  req,
  res
) {
  try {
    const deviceId =
      normalizeDeviceId(
        req.params.deviceId
      );

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message:
          "Device ID is required",
      });
    }

    const device =
      await Device.findOne({
        deviceId,
      }).lean();

    if (!device) {
      return res.status(404).json({
        success: false,
        message:
          "Device not found",
      });
    }

    const offlineTimeoutSeconds =
      await getOfflineTimeoutSeconds();

    return res.json({
      success: true,

      data:
        formatDeviceForDashboard(
          device,
          offlineTimeoutSeconds
        ),
    });
  } catch (error) {
    console.error(
      "Get device by ID error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch device",
      error: error.message,
    });
  }
}

// ============================================================
// GET /api/devices/:deviceId/status
//
// Dashboard live status
// ============================================================

async function getDeviceStatus(
  req,
  res
) {
  try {
    const normalizedDeviceId =
      normalizeDeviceId(
        req.params.deviceId
      );

    if (!normalizedDeviceId) {
      return res.status(400).json({
        success: false,
        message:
          "Device ID is required",
      });
    }

    const device =
      await Device.findOne({
        deviceId:
          normalizedDeviceId,
        isActive: true,
      }).lean();

    if (!device) {
      return res.status(404).json({
        success: false,
        message:
          "Device not found",
      });
    }

    const offlineTimeoutSeconds =
      await getOfflineTimeoutSeconds();

    const secondsSinceLastSeen =
      getSecondsSinceLastSeen(
        device.lastSeen
      );

    return res.json({
      success: true,

      data: {
        deviceId:
          device.deviceId,

        name:
          device.name,

        location:
          device.location,

        status:
          device.status,

        lastSeen:
          device.lastSeen,

        secondsSinceLastSeen,

        offlineTimeoutSeconds,

        firmwareVersion:
          device.firmwareVersion,

        network: {
          wifiRSSI:
            device.network?.wifiRSSI ??
            null,

          ipAddress:
            device.network?.ipAddress ??
            null,
        },

        actuators: {
          pump:
            device.actuators?.pump ??
            false,

          fan:
            device.actuators?.fan ??
            false,

          buzzer:
            device.actuators?.buzzer ??
            false,

          redLed:
            device.actuators?.redLed ??
            false,

          greenLed:
            device.actuators?.greenLed ??
            false,
        },

        hardware: {
          controller:
            device.hardware
              ?.controller ||
            "ESP32",

          sensors:
            device.hardware
              ?.sensors || {},

          actuators:
            device.hardware
              ?.actuators || {},

          gsm:
            device.hardware?.gsm ??
            false,

          lcd:
            device.hardware?.lcd ??
            false,
        },

        isActive:
          device.isActive,

        updatedAt:
          device.updatedAt,
      },
    });
  } catch (error) {
    console.error(
      "Get device status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get device status",
      error: error.message,
    });
  }
}

module.exports = {
  getDevices,
  getDeviceById,
  getDeviceStatus,
};