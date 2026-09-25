const DeviceEvent = require("../models/DeviceEvent");

// GET /api/device-events
async function getDeviceEvents(req, res) {
  try {
    const {
      deviceId,
      eventType,
      limit,
    } = req.query;

    const query = {};

    if (deviceId) {
      query.deviceId = String(deviceId)
        .trim()
        .toUpperCase();
    }

    if (eventType) {
      query.eventType = String(eventType)
        .trim()
        .toUpperCase();
    }

    const parsedLimit = Math.min(
      Math.max(
        parseInt(limit, 10) || 50,
        1
      ),
      500
    );

    const events = await DeviceEvent.find(query)
      .sort({
        occurredAt: -1,
      })
      .limit(parsedLimit)
      .lean();

    return res.json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error(
      "Get device events error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch device events",
    });
  }
}


// GET /api/device-events/:id
async function getDeviceEventById(req, res) {
  try {
    const event =
      await DeviceEvent.findById(
        req.params.id
      ).lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Device event not found",
      });
    }

    return res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error(
      "Get device event error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch device event",
    });
  }
}


// POST /api/device-events
async function createDeviceEvent(req, res) {
  try {
    const {
      deviceId,
      eventType,
      message,
      metadata,
      occurredAt,
    } = req.body;

    // ------------------------------------
    // Validation
    // ------------------------------------

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "deviceId is required",
      });
    }

    if (!eventType) {
      return res.status(400).json({
        success: false,
        message: "eventType is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "message is required",
      });
    }

    const normalizedDeviceId =
      String(deviceId)
        .trim()
        .toUpperCase();

    const normalizedEventType =
      String(eventType)
        .trim()
        .toUpperCase();

    const allowedEventTypes = [
      "ONLINE",
      "OFFLINE",
      "RECONNECTED",
      "BOOT",
      "WIFI_CONNECTED",
      "WIFI_DISCONNECTED",
      "COMMAND_FAILED",
      "SENSOR_ERROR",
      "GSM_ERROR",
      "SYSTEM_ERROR",
    ];

    if (
      !allowedEventTypes.includes(
        normalizedEventType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid device event type",
      });
    }

    // ------------------------------------
    // Validate occurredAt
    // ------------------------------------

    let eventTime = new Date();

    if (occurredAt) {
      const parsedDate =
        new Date(occurredAt);

      if (
        !Number.isNaN(
          parsedDate.getTime()
        )
      ) {
        eventTime = parsedDate;
      }
    }

    // ------------------------------------
    // Create event
    // ------------------------------------

    const event =
      await DeviceEvent.create({
        deviceId:
          normalizedDeviceId,

        eventType:
          normalizedEventType,

        message,

        metadata:
          metadata || {},

        occurredAt: eventTime,
      });

    return res.status(201).json({
      success: true,
      message:
        "Device event created successfully",
      data: event,
    });
  } catch (error) {
    console.error(
      "Create device event error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create device event",
      error: error.message,
    });
  }
}


module.exports = {
  getDeviceEvents,
  getDeviceEventById,
  createDeviceEvent,
};