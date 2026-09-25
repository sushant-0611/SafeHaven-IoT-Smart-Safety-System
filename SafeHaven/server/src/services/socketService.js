const jwt = require("jsonwebtoken");
const User = require("../models/User");

const {
  jwtSecret,
  clientUrl,
} = require("../config/env");

let io = null;

// ============================================================
// INITIALIZE SOCKET.IO
// ============================================================

function initializeSocket(server) {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: clientUrl,
      credentials: true,
    },

    transports: ["websocket", "polling"],
  });

  // ----------------------------------------------------------
  // SOCKET AUTHENTICATION
  // ----------------------------------------------------------

  io.use(async (socket, next) => {
    try {
      const cookieHeader =
        socket.handshake.headers.cookie || "";

      const token = extractCookie(
        cookieHeader,
        "safehaven_token"
      );

      if (!token) {
        return next(
          new Error("Authentication required")
        );
      }

      const decoded = jwt.verify(
        token,
        jwtSecret
      );

      if (!decoded?.userId) {
        return next(
          new Error("Invalid authentication token")
        );
      }

      const user = await User.findById(
        decoded.userId
      ).select("-passwordHash");

      if (!user) {
        return next(
          new Error("User not found")
        );
      }

      if (user.status !== "ACTIVE") {
        return next(
          new Error("User account is not active")
        );
      }

      socket.user = user;

      next();
    } catch (error) {
      console.error(
        "[SOCKET AUTH] Authentication failed:",
        error.message
      );

      next(
        new Error("Socket authentication failed")
      );
    }
  });

  // ----------------------------------------------------------
  // CONNECTION
  // ----------------------------------------------------------

  io.on("connection", (socket) => {
    console.log(
      `[SOCKET] Client connected: ${socket.id}`
    );

    console.log(
      `[SOCKET] User: ${
        socket.user?.email || "unknown"
      }`
    );

    // --------------------------------------------------------
    // JOIN DASHBOARD ROOM
    // --------------------------------------------------------

    socket.join("dashboard");

    console.log(
      `[SOCKET] ${socket.id} joined dashboard room`
    );

    // --------------------------------------------------------
    // JOIN DEVICE ROOM
    // --------------------------------------------------------

    socket.on(
      "device:subscribe",
      (deviceId) => {
        try {
          if (!deviceId) {
            return;
          }

          const normalizedDeviceId =
            String(deviceId)
              .trim()
              .toUpperCase();

          socket.join(
            `device:${normalizedDeviceId}`
          );

          console.log(
            `[SOCKET] ${socket.id} subscribed to ${normalizedDeviceId}`
          );
        } catch (error) {
          console.error(
            "[SOCKET] Device subscribe error:",
            error.message
          );
        }
      }
    );

    // --------------------------------------------------------
    // LEAVE DEVICE ROOM
    // --------------------------------------------------------

    socket.on(
      "device:unsubscribe",
      (deviceId) => {
        try {
          if (!deviceId) {
            return;
          }

          const normalizedDeviceId =
            String(deviceId)
              .trim()
              .toUpperCase();

          socket.leave(
            `device:${normalizedDeviceId}`
          );

          console.log(
            `[SOCKET] ${socket.id} unsubscribed from ${normalizedDeviceId}`
          );
        } catch (error) {
          console.error(
            "[SOCKET] Device unsubscribe error:",
            error.message
          );
        }
      }
    );

    // --------------------------------------------------------
    // PING / CONNECTION TEST
    // --------------------------------------------------------

    socket.on("ping:test", () => {
      socket.emit("pong:test", {
        success: true,
        timestamp: new Date().toISOString(),
      });
    });

    // --------------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------------

    socket.on("disconnect", (reason) => {
      console.log(
        `[SOCKET] Client disconnected: ${socket.id} | Reason: ${reason}`
      );
    });
  });

  console.log(
    "[SOCKET] Socket.IO initialized successfully."
  );

  return io;
}

// ============================================================
// COOKIE HELPER
// ============================================================

function extractCookie(cookieHeader, cookieName) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim());

  const target = cookies.find((cookie) =>
    cookie.startsWith(`${cookieName}=`)
  );

  if (!target) {
    return null;
  }

  return target.substring(
    `${cookieName}=`.length
  );
}

// ============================================================
// GET SOCKET.IO INSTANCE
// ============================================================

function getIO() {
  if (!io) {
    throw new Error(
      "Socket.IO has not been initialized"
    );
  }

  return io;
}

// ============================================================
// TELEMETRY EVENT
// ============================================================

function emitTelemetryUpdate({
  deviceId,
  telemetry,
  deviceStatus,
  alerts,
  automation,
}) {
  if (!io) {
    return;
  }

  if (!deviceId) {
    console.error(
      "[SOCKET] Telemetry update missing deviceId"
    );

    return;
  }

  const normalizedDeviceId =
    String(deviceId)
      .trim()
      .toUpperCase();

  const payload = {
    deviceId: normalizedDeviceId,

    telemetry:
      telemetry || null,

    deviceStatus:
      deviceStatus || null,

    alerts:
      alerts || null,

    automation:
      automation || null,

    timestamp:
      new Date().toISOString(),
  };

  // Dashboard subscribers
  io.to("dashboard").emit(
    "telemetry:update",
    payload
  );

  // Device-specific subscribers
  io.to(
    `device:${normalizedDeviceId}`
  ).emit(
    "device:telemetry",
    payload
  );

  console.log(
    `[SOCKET] telemetry:update emitted for ${normalizedDeviceId}`
  );
}

// ============================================================
// DEVICE STATUS EVENT
// ============================================================

function emitDeviceStatusUpdate({
  deviceId,
  status,
  lastSeen,
  reconnected = false,
  wifiRSSI = null,
  ipAddress = null,
}) {
  if (!io) {
    return;
  }

  if (!deviceId) {
    console.error(
      "[SOCKET] Device status update missing deviceId"
    );

    return;
  }

  const normalizedDeviceId =
    String(deviceId)
      .trim()
      .toUpperCase();

  const payload = {
    deviceId:
      normalizedDeviceId,

    status:
      status || null,

    lastSeen:
      lastSeen || null,

    reconnected:
      Boolean(reconnected),

    wifiRSSI:
      wifiRSSI ?? null,

    ipAddress:
      ipAddress ?? null,

    timestamp:
      new Date().toISOString(),
  };

  // Dashboard subscribers
  io.to("dashboard").emit(
    "device:status",
    payload
  );

  // Device-specific subscribers
  io.to(
    `device:${normalizedDeviceId}`
  ).emit(
    "device:status",
    payload
  );

  console.log(
    `[SOCKET] device:status emitted for ${normalizedDeviceId} -> ${status}`
  );
}

// ============================================================
// ALERT EVENT
// ============================================================

function emitAlertUpdate({
  deviceId,
  alert,
  action = "CREATED",
}) {
  if (!io) {
    return;
  }

  if (!deviceId) {
    console.error(
      "[SOCKET] Alert update missing deviceId"
    );

    return;
  }

  const normalizedDeviceId =
    String(deviceId)
      .trim()
      .toUpperCase();

  const payload = {
    deviceId:
      normalizedDeviceId,

    action,

    alert:
      alert || null,

    timestamp:
      new Date().toISOString(),
  };

  // Dashboard subscribers
  io.to("dashboard").emit(
    "alert:update",
    payload
  );

  // Device-specific subscribers
  io.to(
    `device:${normalizedDeviceId}`
  ).emit(
    "alert:update",
    payload
  );

  console.log(
    `[SOCKET] alert:update emitted for ${normalizedDeviceId} -> ${action}`
  );
}

// ============================================================
// COMMAND EVENT
// ============================================================

function emitCommandUpdate({
  deviceId,
  command,
  action = "UPDATED",
}) {
  if (!io) {
    return;
  }

  if (!deviceId) {
    console.error(
      "[SOCKET] Command update missing deviceId"
    );

    return;
  }

  const normalizedDeviceId =
    String(deviceId)
      .trim()
      .toUpperCase();

  const payload = {
    deviceId:
      normalizedDeviceId,

    action,

    command:
      command || null,

    timestamp:
      new Date().toISOString(),
  };

  // Dashboard subscribers
  io.to("dashboard").emit(
    "command:update",
    payload
  );

  // Device-specific subscribers
  io.to(
    `device:${normalizedDeviceId}`
  ).emit(
    "command:update",
    payload
  );

  console.log(
    `[SOCKET] command:update emitted for ${normalizedDeviceId} -> ${action}`
  );
}

// ============================================================
// NOTIFICATION EVENT
// ============================================================

function emitNotificationUpdate({
  deviceId,
  notification,
  action = "UPDATED",
}) {
  if (!io) {
    return;
  }

  const normalizedDeviceId =
    deviceId
      ? String(deviceId)
          .trim()
          .toUpperCase()
      : null;

  const payload = {
    deviceId:
      normalizedDeviceId,

    action,

    notification:
      notification || null,

    timestamp:
      new Date().toISOString(),
  };

  // Dashboard subscribers
  io.to("dashboard").emit(
    "notification:update",
    payload
  );

  // Device-specific subscribers
  if (normalizedDeviceId) {
    io.to(
      `device:${normalizedDeviceId}`
    ).emit(
      "notification:update",
      payload
    );
  }

  console.log(
    `[SOCKET] notification:update emitted${
      normalizedDeviceId
        ? ` for ${normalizedDeviceId}`
        : ""
    } -> ${action}`
  );
}

// ============================================================
// DASHBOARD REFRESH EVENT
// ============================================================
//
// IMPORTANT:
// Controllers currently use:
//
// emitDashboardRefresh(...)
//
// Therefore this function must be exported with exactly
// this name.
//
// Extra fields are supported so controllers can send things
// such as:
//
// safetyStatus
// safetyReason
// commandId
// status
// etc.
// ============================================================

function emitDashboardRefresh({
  reason,
  deviceId = null,
  ...extra
}) {
  if (!io) {
    return;
  }

  const normalizedDeviceId =
    deviceId
      ? String(deviceId)
          .trim()
          .toUpperCase()
      : null;

  const payload = {
    reason:
      reason || "GENERAL_UPDATE",

    deviceId:
      normalizedDeviceId,

    ...extra,

    timestamp:
      new Date().toISOString(),
  };

  io.to("dashboard").emit(
    "dashboard:update",
    payload
  );

  console.log(
    `[SOCKET] dashboard:update emitted -> ${payload.reason}${
      normalizedDeviceId
        ? ` | ${normalizedDeviceId}`
        : ""
    }`
  );
}

// ============================================================
// BACKWARD COMPATIBILITY
// ============================================================
//
// If any older controller still imports
// emitDashboardUpdate, it will continue to work.
// New code should use emitDashboardRefresh.
// ============================================================

const emitDashboardUpdate =
  emitDashboardRefresh;

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  initializeSocket,

  getIO,

  emitTelemetryUpdate,

  emitDeviceStatusUpdate,

  emitAlertUpdate,

  emitCommandUpdate,

  emitNotificationUpdate,

  emitDashboardRefresh,

  // Backward compatibility
  emitDashboardUpdate,
};