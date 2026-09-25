import {
  Activity,
  Bell,
  CheckCircle2,
  Flame,
  Gauge,
  Power,
  Thermometer,
  Volume2,
  Waves,
  Wind,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import { useSocket } from "../context/SocketContext";

import {
  subscribeToDevice,
  unsubscribeFromDevice,
} from "../services/socket";

import api from "../services/api";

import "../styles/dashboard.css";

const DEVICE_ID = "SAFEHAVEN-001";

/* =========================================================
   HELPERS
   ========================================================= */

function formatTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diff = Math.max(
    0,
    Math.floor(
      (Date.now() - date.getTime()) / 1000
    )
  );

  if (diff < 5) {
    return "Just now";
  }

  if (diff < 60) {
    return `${diff} sec ago`;
  }

  const minutes = Math.floor(diff / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day ago`;
}

function getSafetyLabel(status) {
  switch (status) {
    case "DANGER":
      return "System Danger";

    case "WARNING":
      return "System Warning";

    case "SAFE":
    default:
      return "System Safe";
  }
}

function getSafetyDescription(status, reason) {
  if (status === "DANGER") {
    return (
      reason ||
      "Dangerous conditions detected. Immediate attention is required."
    );
  }

  if (status === "WARNING") {
    return (
      reason ||
      "One or more monitored parameters require attention."
    );
  }

  return (
    reason ||
    "All monitored parameters are currently within safe limits."
  );
}

function getSensorStatus(value, warning, danger) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Unknown";
  }

  if (numericValue >= danger) {
    return "Danger";
  }

  if (numericValue >= warning) {
    return "Warning";
  }

  return "Normal";
}

function getStatusClass(status) {
  switch (status) {
    case "DANGER":
      return "danger";

    case "WARNING":
      return "warning";

    case "SAFE":
      return "safe";

    default:
      return "neutral";
  }
}

/* =========================================================
   SENSOR CONFIGURATION
   ========================================================= */

const sensorConfig = [
  {
    key: "temperature",
    title: "Temperature",
    unit: "°C",
    icon: Thermometer,
    warning: 40,
    danger: 45,
  },
  {
    key: "humidity",
    title: "Humidity",
    unit: "%",
    icon: Waves,
    warning: 60,
    danger: 80,
  },
  {
    key: "smoke",
    title: "Smoke",
    unit: "%",
    icon: Wind,
    warning: 40,
    danger: 70,
  },
  {
    key: "gas",
    title: "Gas",
    unit: "%",
    icon: Gauge,
    warning: 40,
    danger: 70,
  },
  {
    key: "fire",
    title: "Fire",
    unit: "Level",
    icon: Flame,
    warning: 50,
    danger: 70,
  },
  {
    key: "noise",
    title: "Noise",
    unit: "dB",
    icon: Volume2,
    warning: 50,
    danger: 80,
  },
];

/* =========================================================
   SENSOR CARD
   ========================================================= */

function SensorCard({ sensor }) {
  const Icon = sensor.icon;

  const statusClass =
    sensor.status.toLowerCase();

  return (
    <article
      className={`sensor-card ${statusClass}`}
    >
      <div className="sensor-card-top">
        <div className="sensor-icon">
          <Icon size={20} />
        </div>

        <span className="sensor-status">
          <span className="sensor-status-dot" />
          {sensor.status}
        </span>
      </div>

      <div className="sensor-card-body">
        <span className="sensor-title">
          {sensor.title}
        </span>

        <div className="sensor-value-row">
          <strong className="sensor-value">
            {sensor.value}
          </strong>

          <span className="sensor-unit">
            {sensor.unit}
          </span>
        </div>
      </div>
    </article>
  );
}

/* =========================================================
   DEVICE STATUS
   ========================================================= */

function DeviceStatus({
  icon: Icon,
  title,
  status,
  active,
}) {
  return (
    <div className="device-status">
      <div
        className={`device-icon ${
          active ? "active" : ""
        }`}
      >
        <Icon size={20} />
      </div>

      <div className="device-info">
        <span>{title}</span>

        <strong
          className={
            active
              ? "device-status-on"
              : "device-status-off"
          }
        >
          {status}
        </strong>
      </div>

      <div
        className={`toggle-indicator ${
          active ? "on" : ""
        }`}
      >
        <span />
      </div>
    </div>
  );
}

/* =========================================================
   INFO ROW
   ========================================================= */

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* =========================================================
   ACTIVITY ROW
   ========================================================= */

function ActivityRow({
  icon: Icon,
  title,
  description,
  time,
  type = "info",
}) {
  return (
    <div className="activity-row">
      <div
        className={`activity-icon ${type}`}
      >
        <Icon size={17} />
      </div>

      <div className="activity-content">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <time>{time}</time>
    </div>
  );
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function Dashboard() {
  const {
    socket,
    connected,
  } = useSocket();

  /* =======================================================
     UI STATE
     ======================================================= */

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     TELEMETRY STATE
     ======================================================= */

  const [telemetry, setTelemetry] =
    useState({
      temperature: 0,
      humidity: 0,
      smoke: 0,
      gas: 0,
      noise: 0,
      fire: 0,
      safetyStatus: "SAFE",
      safetyReason: "",
      pump: false,
      fan: false,
      buzzer: false,
      redLed: false,
      greenLed: true,
      wifiRSSI: null,
      timestamp: null,
    });

  /* =======================================================
     DEVICE STATE
     ======================================================= */

  const [deviceStatus, setDeviceStatus] =
    useState("OFFLINE");

  const [lastSeen, setLastSeen] =
    useState(null);

  /* =======================================================
     ALERT STATE
     ======================================================= */

  const [alertCount, setAlertCount] =
    useState(0);

  /* =======================================================
     ACTIVITY STATE
     ======================================================= */

  const [activities, setActivities] =
    useState([]);

  /* =======================================================
     ACTIVITY HELPER
     ======================================================= */

  const addActivity = useCallback(
    ({
      icon,
      title,
      description,
      type = "info",
    }) => {
      setActivities((previous) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          icon,
          title,
          description,
          time: new Date(),
          type,
        },
        ...previous,
      ].slice(0, 6));
    },
    []
  );

  /* =======================================================
     LOAD DASHBOARD DATA
     ======================================================= */

  const loadDashboardData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const [
          statisticsResponse,
          latestResponse,
          statusResponse,
        ] = await Promise.all([
          api.get("/dashboard/statistics"),

          api.get(
            `/devices/${DEVICE_ID}/latest`
          ),

          api.get(
            `/devices/${DEVICE_ID}/status`
          ),
        ]);

        /* ==============================================
           STATISTICS
           ============================================== */

        const statistics =
          statisticsResponse.data?.data || {};

        /* ==============================================
           LATEST TELEMETRY
           ============================================== */

        const latest =
          latestResponse.data?.data ||
          statistics.latestTelemetry ||
          {};

        /* ==============================================
           DEVICE STATUS
           ============================================== */

        const statusData =
          statusResponse.data?.data ||
          statistics.deviceStatus ||
          {};

        /* ==============================================
           TELEMETRY
           ============================================== */

        if (
          latest &&
          Object.keys(latest).length > 0
        ) {
          setTelemetry((previous) => ({
            ...previous,
            ...latest,
          }));

          if (latest.timestamp) {
            setLastSeen(
              latest.timestamp
            );
          }
        }

        if (
          statistics.latestTelemetry
        ) {
          setTelemetry((previous) => ({
            ...previous,
            ...statistics.latestTelemetry,
          }));
        }

        if (
          statistics.latestTelemetry?.timestamp
        ) {
          setLastSeen(
            statistics.latestTelemetry.timestamp
          );
        }

        /* ==============================================
           DEVICE STATUS
           ============================================== */

        const resolvedStatus =
          statusData.status ||
          statistics.deviceStatus?.status ||
          "OFFLINE";

        setDeviceStatus(
          resolvedStatus
        );

        if (
          statusData.lastSeen ||
          statistics.deviceStatus?.lastSeen
        ) {
          setLastSeen(
            statusData.lastSeen ||
              statistics.deviceStatus?.lastSeen
          );
        }

        /* ==============================================
           ALERT COUNT
           ============================================== */

        if (
          typeof statistics.todayAlerts ===
          "number"
        ) {
          setAlertCount(
            statistics.todayAlerts
          );
        }

        /* ==============================================
           INITIAL ACTIVITY
           ============================================== */

        if (!isRefresh) {
          addActivity({
            icon:
              resolvedStatus === "ONLINE"
                ? Wifi
                : WifiOff,

            title:
              resolvedStatus === "ONLINE"
                ? "Device online"
                : "Device offline",

            description:
              resolvedStatus === "ONLINE"
                ? `${DEVICE_ID} is connected to SafeHaven.`
                : `${DEVICE_ID} is currently offline.`,

            type:
              resolvedStatus === "ONLINE"
                ? "success"
                : "info",
          });

          addActivity({
            icon: Activity,
            title:
              "Dashboard synchronized",
            description:
              "Latest SafeHaven data loaded from the backend.",
            type: "info",
          });
        }
      } catch (requestError) {
        console.error(
          "[DASHBOARD] Initial data error:",
          requestError
        );

        setError(
          requestError.response?.data?.message ||
            "Unable to load dashboard data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addActivity]
  );

  /* =======================================================
     INITIAL DATA LOAD
     ======================================================= */

  useEffect(() => {
    loadDashboardData(false);
  }, [loadDashboardData]);

  /* =======================================================
     DEVICE SUBSCRIPTION
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    if (socket.connected) {
      subscribeToDevice(DEVICE_ID);
    }

    function handleConnect() {
      subscribeToDevice(DEVICE_ID);

      addActivity({
        icon: Wifi,
        title:
          "Realtime connection established",
        description:
          "SafeHaven dashboard is connected to the backend.",
        type: "success",
      });
    }

    socket.on(
      "connect",
      handleConnect
    );

    return () => {
      unsubscribeFromDevice(
        DEVICE_ID
      );

      socket.off(
        "connect",
        handleConnect
      );
    };
  }, [
    socket,
    addActivity,
  ]);

  /* =======================================================
     REALTIME TELEMETRY
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleTelemetryUpdate(
      payload
    ) {
      const incoming =
        payload?.telemetry;

      if (!incoming) {
        return;
      }

      setTelemetry((previous) => ({
        ...previous,
        ...incoming,
      }));

      if (payload?.deviceStatus) {
        setDeviceStatus(
          payload.deviceStatus.status ||
            "ONLINE"
        );

        setLastSeen(
          payload.deviceStatus.lastSeen ||
            incoming.timestamp ||
            null
        );
      }

      addActivity({
        icon: Activity,
        title:
          "Telemetry updated",
        description:
          `Temperature ${
            incoming.temperature ?? "--"
          }°C · Humidity ${
            incoming.humidity ?? "--"
          }%`,
        type: "info",
      });
    }

    function handleDeviceTelemetry(
      payload
    ) {
      const incoming =
        payload?.telemetry;

      if (!incoming) {
        return;
      }

      setTelemetry((previous) => ({
        ...previous,
        ...incoming,
      }));

      if (incoming.timestamp) {
        setLastSeen(
          incoming.timestamp
        );
      }
    }

    socket.on(
      "telemetry:update",
      handleTelemetryUpdate
    );

    socket.on(
      "device:telemetry",
      handleDeviceTelemetry
    );

    return () => {
      socket.off(
        "telemetry:update",
        handleTelemetryUpdate
      );

      socket.off(
        "device:telemetry",
        handleDeviceTelemetry
      );
    };
  }, [
    socket,
    addActivity,
  ]);

  /* =======================================================
     DEVICE STATUS
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleDeviceStatus(
      payload
    ) {
      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      const status =
        payload.status ||
        "OFFLINE";

      setDeviceStatus(status);

      if (payload.lastSeen) {
        setLastSeen(
          payload.lastSeen
        );
      }

      if (status === "ONLINE") {
        addActivity({
          icon: Wifi,

          title:
            payload.reconnected
              ? "Device reconnected"
              : "Device connected",

          description:
            `${DEVICE_ID} is online.`,

          type: "success",
        });
      }

      if (status === "OFFLINE") {
        addActivity({
          icon: WifiOff,
          title:
            "Device disconnected",
          description:
            `${DEVICE_ID} is offline.`,
          type: "warning",
        });
      }
    }

    socket.on(
      "device:status",
      handleDeviceStatus
    );

    return () => {
      socket.off(
        "device:status",
        handleDeviceStatus
      );
    };
  }, [
    socket,
    addActivity,
  ]);

  /* =======================================================
     ALERT UPDATE
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleAlertUpdate(
      payload
    ) {
      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      const action =
        payload?.action;

      if (action === "CREATED") {
        setAlertCount(
          (count) => count + 1
        );

        addActivity({
          icon: Bell,

          title:
            payload?.alert?.title ||
            "Safety alert created",

          description:
            payload?.alert?.message ||
            "A new safety alert was generated.",

          type: "warning",
        });
      }

      if (action === "RESOLVED") {
        setAlertCount(
          (count) =>
            Math.max(0, count - 1)
        );

        addActivity({
          icon: CheckCircle2,

          title:
            "Safety alert resolved",

          description:
            payload?.alert?.message ||
            "Safety condition resolved.",

          type: "success",
        });
      }
    }

    socket.on(
      "alert:update",
      handleAlertUpdate
    );

    return () => {
      socket.off(
        "alert:update",
        handleAlertUpdate
      );
    };
  }, [
    socket,
    addActivity,
  ]);

  /* =======================================================
     COMMAND UPDATE
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleCommandUpdate(
      payload
    ) {
      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      const command =
        payload?.command;

      if (!command) {
        return;
      }

      addActivity({
        icon: Power,

        title:
          "Actuator command updated",

        description:
          `${command.command || "Command"} → ${
            command.status || "UPDATED"
          }`,

        type:
          command.status === "FAILED"
            ? "warning"
            : "info",
      });

      if (
        command.command &&
        command.status === "EXECUTED"
      ) {
        setTelemetry((previous) => {
          const updated = {
            ...previous,
          };

          switch (
            command.command
          ) {
            case "PUMP_ON":
              updated.pump = true;
              break;

            case "PUMP_OFF":
              updated.pump = false;
              break;

            case "FAN_ON":
              updated.fan = true;
              break;

            case "FAN_OFF":
              updated.fan = false;
              break;

            case "BUZZER_ON":
              updated.buzzer = true;
              break;

            case "BUZZER_OFF":
              updated.buzzer = false;
              break;

            case "RED_LED_ON":
              updated.redLed = true;
              break;

            case "RED_LED_OFF":
              updated.redLed = false;
              break;

            case "GREEN_LED_ON":
              updated.greenLed = true;
              break;

            case "GREEN_LED_OFF":
              updated.greenLed = false;
              break;

            case "ALL_ACTUATORS_OFF":
              updated.pump = false;
              updated.fan = false;
              updated.buzzer = false;
              updated.redLed = false;
              updated.greenLed = false;
              break;

            default:
              break;
          }

          return updated;
        });
      }
    }

    socket.on(
      "command:update",
      handleCommandUpdate
    );

    return () => {
      socket.off(
        "command:update",
        handleCommandUpdate
      );
    };
  }, [
    socket,
    addActivity,
  ]);

  /* =======================================================
     NOTIFICATION UPDATE
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleNotificationUpdate(
      payload
    ) {
      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      addActivity({
        icon: Bell,

        title:
          "Notification updated",

        description:
          payload?.notification?.message ||
          "Notification status changed.",

        type: "info",
      });
    }

    socket.on(
      "notification:update",
      handleNotificationUpdate
    );

    return () => {
      socket.off(
        "notification:update",
        handleNotificationUpdate
      );
    };
  }, [
    socket,
    addActivity,
  ]);

  /* =======================================================
     DASHBOARD UPDATE
     ======================================================= */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    function handleDashboardUpdate(
      payload
    ) {
      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      addActivity({
        icon: Activity,

        title:
          "Dashboard data updated",

        description:
          payload?.reason ||
          "Dashboard data was refreshed.",

        type: "info",
      });

      loadDashboardData(true);
    }

    socket.on(
      "dashboard:update",
      handleDashboardUpdate
    );

    return () => {
      socket.off(
        "dashboard:update",
        handleDashboardUpdate
      );
    };
  }, [
    socket,
    addActivity,
    loadDashboardData,
  ]);

  /* =======================================================
     DERIVED SENSOR DATA
     ======================================================= */

  const sensorData = useMemo(() => {
    return sensorConfig.map(
      (config) => {
        const value =
          telemetry[config.key] ?? 0;

        return {
          ...config,
          value,

          status:
            getSensorStatus(
              value,
              config.warning,
              config.danger
            ),
        };
      }
    );
  }, [telemetry]);

  /* =======================================================
     SAFETY STATUS
     ======================================================= */

  const safetyStatus =
    telemetry.safetyStatus ||
    "SAFE";

  const safetyTitle =
    getSafetyLabel(
      safetyStatus
    );

  const safetyDescription =
    getSafetyDescription(
      safetyStatus,
      telemetry.safetyReason
    );

  const safetyClass =
    getStatusClass(
      safetyStatus
    );

  /* =======================================================
     DEVICE CONNECTION
     ======================================================= */

  const isDeviceOnline =
    deviceStatus === "ONLINE";

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="dashboard-page">

      {/* ERROR */}

      {error && (
        <div
          className="dashboard-error"
          role="alert"
        >
          <div>
            <strong>
              Unable to load latest data
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              loadDashboardData(true)
            }
            disabled={refreshing}
          >
            {refreshing
              ? "Retrying..."
              : "Retry"}
          </button>
        </div>
      )}

      {/* MAIN DASHBOARD */}

      <div className="dashboard-content">

        {/* =================================================
            SAFETY STATUS
            ================================================= */}

        <section
          className={`safety-banner ${safetyClass}`}
        >
          <div className="safety-left">

            <div className="safety-icon">
              {safetyStatus === "SAFE" ? (
                <CheckCircle2
                  size={28}
                />
              ) : (
                <Gauge size={28} />
              )}
            </div>

            <div className="safety-copy">
              <span className="eyebrow">
                OVERALL SAFETY STATUS
              </span>

              <h2>
                {safetyTitle}
              </h2>

              <p>
                {safetyDescription}
              </p>
            </div>
          </div>

          <div className="safety-right">

            <div className="last-updated">
              <span className="eyebrow">
                LAST UPDATED
              </span>

              <strong>
                {formatRelativeTime(
                  telemetry.timestamp
                )}
              </strong>
            </div>

            <div className="live-indicator">
              <span
                className={
                  connected
                    ? ""
                    : "offline"
                }
              />

              {connected
                ? "LIVE"
                : "OFFLINE"}
            </div>
          </div>
        </section>

        {/* =================================================
            ENVIRONMENTAL MONITORING
            ================================================= */}

        <section className="section environmental-section">

          <div className="section-header">
            <div>
              <h2>
                Environmental Monitoring
              </h2>

              <p>
                Real-time sensor readings
                from SafeHaven device
              </p>
            </div>

            <Link
              to="/live-monitoring"
              className="view-button"
            >
              View details
              <span>→</span>
            </Link>
          </div>

          {loading ? (
            <div className="dashboard-loading">
              <div className="loading-spinner" />

              <strong>
                Loading SafeHaven dashboard...
              </strong>

              <span>
                Fetching latest device and
                telemetry data.
              </span>
            </div>
          ) : (
            <div className="sensor-grid">
              {sensorData.map(
                (sensor) => (
                  <SensorCard
                    key={sensor.key}
                    sensor={sensor}
                  />
                )
              )}
            </div>
          )}
        </section>

        {/* =================================================
            LOWER HORIZONTAL GRID
            ================================================= */}

        {!loading && (
          <div className="lower-grid">

            {/* DEVICE CONTROL */}

            <section className="panel">

              <div className="panel-header">
                <div>
                  <h2>
                    Device Control
                  </h2>

                  <p>
                    Current actuator status
                  </p>
                </div>

                <span className="auto-badge">
                  <span />
                  AUTO MODE
                </span>
              </div>

              <div className="device-list">

                <DeviceStatus
                  icon={Waves}
                  title="Water Pump"
                  status={
                    telemetry.pump
                      ? "ON"
                      : "OFF"
                  }
                  active={
                    telemetry.pump
                  }
                />

                <DeviceStatus
                  icon={Wind}
                  title="Exhaust Fan"
                  status={
                    telemetry.fan
                      ? "ON"
                      : "OFF"
                  }
                  active={
                    telemetry.fan
                  }
                />

                <DeviceStatus
                  icon={Bell}
                  title="Buzzer"
                  status={
                    telemetry.buzzer
                      ? "ON"
                      : "OFF"
                  }
                  active={
                    telemetry.buzzer
                  }
                />

              </div>
            </section>

            {/* SYSTEM INFORMATION */}

            <section className="panel">

              <div className="panel-header">
                <div>
                  <h2>
                    System Information
                  </h2>

                  <p>
                    SafeHaven device status
                  </p>
                </div>

                <span
                  className={`status-badge ${
                    isDeviceOnline
                      ? "success"
                      : "neutral"
                  }`}
                >
                  {isDeviceOnline
                    ? "ONLINE"
                    : "OFFLINE"}
                </span>
              </div>

              <div className="system-info">

                <InfoRow
                  label="Device ID"
                  value={DEVICE_ID}
                />

                <InfoRow
                  label="Connection"
                  value={
                    isDeviceOnline
                      ? "Wi-Fi Connected"
                      : "Device Offline"
                  }
                />

                <InfoRow
                  label="Signal Strength"
                  value={
                    telemetry.wifiRSSI !== null
                      ? `${telemetry.wifiRSSI} dBm`
                      : "--"
                  }
                />

                <InfoRow
                  label="Operating Mode"
                  value="Automatic"
                />

                <InfoRow
                  label="Last Sync"
                  value={formatTime(
                    lastSeen ||
                      telemetry.timestamp
                  )}
                />

              </div>
            </section>

            {/* RECENT ACTIVITY */}

            <section className="panel activity-panel">

              <div className="panel-header">
                <div>
                  <h2>
                    Recent Activity
                  </h2>

                  <p>
                    Latest events received
                    by the system
                  </p>
                </div>

                <Link
                  to="/history"
                  className="view-button"
                >
                  View history
                  <span>→</span>
                </Link>
              </div>

              <div className="activity-list">

                {activities.length === 0 ? (
                  <ActivityRow
                    icon={Activity}
                    title="Waiting for realtime events"
                    description={
                      connected
                        ? "Socket.IO connected. Waiting for device updates."
                        : "Connecting to SafeHaven realtime server..."
                    }
                    time="Just now"
                    type={
                      connected
                        ? "success"
                        : "info"
                    }
                  />
                ) : (
                  activities.map(
                    (activity) => (
                      <ActivityRow
                        key={activity.id}
                        icon={activity.icon}
                        title={
                          activity.title
                        }
                        description={
                          activity.description
                        }
                        time={formatRelativeTime(
                          activity.time
                        )}
                        type={
                          activity.type
                        }
                      />
                    )
                  )
                )}

              </div>
            </section>

          </div>
        )}

      </div>
    </div>
  );
}

export default Dashboard;