import {
  Activity,
  AlertTriangle,
  Bell,
  Flame,
  Gauge,
  Radio,
  Thermometer,
  Volume2,
  Waves,
  Wind,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useEffect, useMemo, useState } from "react";

import { useSocket } from "../context/SocketContext";

import {
  subscribeToDevice,
  unsubscribeFromDevice,
} from "../services/socket";

import api from "../services/api";

import "../styles/live-monitoring.css";

const DEVICE_ID = "SAFEHAVEN-001";

/* ======================================================
   HELPERS
====================================================== */

function formatTime(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diff = Math.floor(
    (Date.now() - date.getTime()) / 1000
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

function formatChartTime(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getFireStatus(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Unknown";
  }

  if (numericValue >= 70) {
    return "Fire Detected";
  }

  if (numericValue >= 50) {
    return "Warning";
  }

  return "No Fire Detected";
}

/* ======================================================
   SENSOR CONFIGURATION
====================================================== */

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
    title: "Smoke Level",
    unit: "%",
    icon: Wind,
    warning: 40,
    danger: 70,
  },
  {
    key: "gas",
    title: "Gas Level",
    unit: "%",
    icon: Gauge,
    warning: 40,
    danger: 70,
  },
  {
    key: "fire",
    title: "Fire Sensor",
    unit: "",
    icon: Flame,
    warning: 50,
    danger: 70,
  },
  {
    key: "noise",
    title: "Noise Level",
    unit: "dB",
    icon: Volume2,
    warning: 50,
    danger: 80,
  },
];

/* ======================================================
   SENSOR CARD
====================================================== */

function SensorCard({ sensor }) {
  const Icon = sensor.icon;

  let status = sensor.status;

  if (sensor.key === "fire") {
    status = getFireStatus(sensor.value);
  }

  const statusClass =
    status === "Danger" || status === "Fire Detected"
      ? "danger"
      : status === "Warning"
        ? "warning"
        : status === "Unknown"
          ? "unknown"
          : "normal";

  return (
    <div className="live-sensor-card">
      <div className="live-sensor-header">
        <div className="live-sensor-icon">
          <Icon size={20} />
        </div>

        <span className={`sensor-status ${statusClass}`}>
          <span className="status-dot" />
          {status}
        </span>
      </div>

      <div className="live-sensor-title">
        {sensor.title}
      </div>

      <div className="live-sensor-value">
        {sensor.value}
        <span>{sensor.unit}</span>
      </div>
    </div>
  );
}

/* ======================================================
   CHART CARD
====================================================== */

function ChartCard({
  title,
  dataKey,
  unit,
  data,
}) {
  return (
    <div className="monitor-chart-card">
      <div className="chart-card-header">
        <div>
          <h3>{title}</h3>

          <span>
            Recent telemetry history
          </span>
        </div>

        <Activity size={20} />
      </div>

      <div className="chart-container">
        {data.length === 0 ? (
          <div className="chart-empty">
            <Activity size={22} />

            <span>
              Waiting for telemetry data...
            </span>
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
              />

              <Tooltip
                formatter={(value) => [
                  `${value} ${unit}`,
                  title,
                ]}
              />

              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ======================================================
   OUTPUT CARD
====================================================== */

function OutputCard({
  title,
  value,
  icon: Icon,
}) {
  const isOn = Boolean(value);

  return (
    <div className="output-card">
      <div
        className={`output-icon ${
          isOn ? "active" : ""
        }`}
      >
        <Icon size={21} />
      </div>

      <div className="output-info">
        <span>{title}</span>

        <strong>
          {isOn ? "ON" : "OFF"}
        </strong>
      </div>

      <div
        className={`output-indicator ${
          isOn ? "on" : "off"
        }`}
      >
        {isOn ? "ACTIVE" : "OFF"}
      </div>
    </div>
  );
}

/* ======================================================
   LIVE MONITORING
====================================================== */

function LiveMonitoring() {
  const {
    socket,
    connected,
  } = useSocket();

  /* ====================================================
     TELEMETRY
  ==================================================== */

  const [
    telemetry,
    setTelemetry,
  ] = useState({
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

  /* ====================================================
     HISTORY
  ==================================================== */

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(true);

  /* ====================================================
     DEVICE STATUS
  ==================================================== */

  const [
    deviceStatus,
    setDeviceStatus,
  ] = useState("OFFLINE");

  const [
    lastSeen,
    setLastSeen,
  ] = useState(null);

  /* ====================================================
     INITIAL DATA
  ==================================================== */

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);

        const [
          latestResponse,
          statusResponse,
          historyResponse,
        ] = await Promise.all([
          api.get(
            `/devices/${DEVICE_ID}/latest`
          ),

          api.get(
            `/devices/${DEVICE_ID}/status`
          ),

          api.get(
            `/devices/${DEVICE_ID}/history`,
            {
              params: {
                page: 1,
                limit: 50,
              },
            }
          ),
        ]);

        if (!mounted) return;

        /* Latest telemetry */

        if (
          latestResponse.data?.success &&
          latestResponse.data?.data
        ) {
          setTelemetry((previous) => ({
            ...previous,
            ...latestResponse.data.data,
          }));
        }

        /* Device status */

        if (
          statusResponse.data?.success &&
          statusResponse.data?.data
        ) {
          const status =
            statusResponse.data.data;

          setDeviceStatus(
            status.status || "OFFLINE"
          );

          setLastSeen(
            status.lastSeen || null
          );
        }

        /* History */

        if (
          historyResponse.data?.success
        ) {
          const historyData =
            historyResponse.data?.data;

          const items =
            Array.isArray(historyData)
              ? historyData
              : Array.isArray(
                    historyData?.items
                  )
                ? historyData.items
                : [];

          setHistory(
            items
              .slice()
              .reverse()
          );
        }
      } catch (error) {
        console.error(
          "[LIVE MONITORING] Initial data error:",
          error.response?.data ||
            error.message
        );
      } finally {
        if (mounted) {
          setLoading(false);
          setHistoryLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  /* ====================================================
     DEVICE SUBSCRIPTION
  ==================================================== */

  useEffect(() => {
    if (!socket) {
      return;
    }

    if (socket.connected) {
      subscribeToDevice(DEVICE_ID);
    }

    function handleConnect() {
      subscribeToDevice(DEVICE_ID);
    }

    socket.on(
      "connect",
      handleConnect
    );

    return () => {
      unsubscribeFromDevice(DEVICE_ID);

      socket.off(
        "connect",
        handleConnect
      );
    };
  }, [socket]);

  /* ====================================================
     REALTIME TELEMETRY
  ==================================================== */

  useEffect(() => {
    if (!socket) {
      return;
    }

    function handleTelemetryUpdate(
      payload
    ) {
      const incoming =
        payload?.telemetry;

      if (!incoming) {
        return;
      }

      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      setTelemetry((previous) => ({
        ...previous,
        ...incoming,
      }));

      if (
        payload?.deviceStatus
      ) {
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

      /* Add realtime point to chart */

      setHistory((previous) => {
        const updated = [
          ...previous,
          incoming,
        ];

        return updated.slice(-50);
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

      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      setTelemetry((previous) => ({
        ...previous,
        ...incoming,
      }));

      setHistory((previous) => {
        const updated = [
          ...previous,
          incoming,
        ];

        return updated.slice(-50);
      });
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
  }, [socket]);

  /* ====================================================
     REALTIME DEVICE STATUS
  ==================================================== */

  useEffect(() => {
    if (!socket) {
      return;
    }

    function handleDeviceStatus(
      payload
    ) {
      if (
        payload?.deviceId !==
        DEVICE_ID
      ) {
        return;
      }

      setDeviceStatus(
        payload.status ||
          "OFFLINE"
      );

      if (payload.lastSeen) {
        setLastSeen(
          payload.lastSeen
        );
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
  }, [socket]);

  /* ====================================================
     REALTIME COMMAND UPDATE
  ==================================================== */

  useEffect(() => {
    if (!socket) {
      return;
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

      if (
        command.status !==
        "EXECUTED"
      ) {
        return;
      }

      setTelemetry((previous) => {
        const updated = {
          ...previous,
        };

        switch (command.command) {
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

          default:
            break;
        }

        return updated;
      });
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
  }, [socket]);

  /* ====================================================
     DERIVED SENSOR DATA
  ==================================================== */

  const sensors = useMemo(() => {
    return sensorConfig.map(
      (config) => {
        const value =
          telemetry[config.key] ??
          0;

        return {
          ...config,
          value,

          status:
            config.key === "fire"
              ? getFireStatus(value)
              : getSensorStatus(
                  value,
                  config.warning,
                  config.danger
                ),
        };
      }
    );
  }, [telemetry]);

  /* ====================================================
     CHART DATA
  ==================================================== */

  const chartData = useMemo(() => {
    return history.map(
      (item) => ({
        ...item,

        time: formatChartTime(
          item.timestamp ||
            item.createdAt
        ),
      })
    );
  }, [history]);

  /* ====================================================
     SAFETY
  ==================================================== */

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

  /* ====================================================
     DEVICE
  ==================================================== */

  const isDeviceOnline =
    deviceStatus === "ONLINE";

  /* ====================================================
     RENDER
  ==================================================== */

  return (
    <div className="live-monitoring-page">

      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <div className="page-header">
        <div>
          <div className="page-title-row">
            <Radio size={24} />

            <h1>
              Live Monitoring
            </h1>
          </div>

          <p>
            Real-time monitoring of your
            SafeHaven safety device.
          </p>
        </div>

        <div
          className={`live-indicator ${
            connected
              ? ""
              : "offline"
          }`}
        >
          <span />

          {connected
            ? "LIVE"
            : "OFFLINE"}
        </div>
      </div>

      {/* ==================================================
          SYSTEM STATUS
      ================================================== */}

      <div className="monitor-status-bar">

        <div className="monitor-system-status">
          <div
            className={`online-icon ${
              isDeviceOnline
                ? "online"
                : "offline"
            }`}
          >
            {isDeviceOnline ? (
              <Wifi size={21} />
            ) : (
              <WifiOff size={21} />
            )}
          </div>

          <div>
            <span>
              System Status
            </span>

            <strong>
              {isDeviceOnline
                ? "System Online"
                : "System Offline"}
            </strong>
          </div>
        </div>

        <div className="monitor-status-divider" />

        <div className="monitor-info-item">
          <span>
            Device
          </span>

          <strong>
            {DEVICE_ID}
          </strong>
        </div>

        <div className="monitor-info-item">
          <span>
            Last Updated
          </span>

          <strong>
            {formatRelativeTime(
              telemetry.timestamp
            )}
          </strong>
        </div>

        <div className="monitor-info-item">
          <span>
            Wi-Fi Signal
          </span>

          <strong>
            {telemetry.wifiRSSI !== null
              ? `${telemetry.wifiRSSI} dBm`
              : "--"}
          </strong>
        </div>
      </div>

      {/* ==================================================
          SENSOR SECTION
      ================================================== */}

      <section className="monitor-section">

        <div className="section-heading">
          <div>
            <h2>
              Environmental Monitoring
            </h2>

            <p>
              Current sensor readings
            </p>
          </div>

          <div className="section-live">
            <span />
            Live Data
          </div>
        </div>

        <div className="live-sensor-grid">
          {sensors.map(
            (sensor) => (
              <SensorCard
                key={sensor.key}
                sensor={sensor}
              />
            )
          )}
        </div>
      </section>

      {/* ==================================================
          SAFETY STATUS
      ================================================== */}

      <div
        className={`monitor-alert ${safetyStatus.toLowerCase()}`}
      >
        <div className="monitor-alert-icon">
          {safetyStatus === "SAFE" ? (
            <Activity size={21} />
          ) : (
            <AlertTriangle
              size={21}
            />
          )}
        </div>

        <div>
          <strong>
            {safetyTitle}
          </strong>

          <p>
            {safetyDescription}
          </p>
        </div>

        <Bell size={20} />
      </div>

      {/* ==================================================
          CHARTS
      ================================================== */}

      <section className="monitor-section">

        <div className="section-heading">
          <div>
            <h2>
              Real-Time Sensor Trends
            </h2>

            <p>
              Telemetry history from
              SafeHaven device
            </p>
          </div>
        </div>

        <div className="monitor-chart-grid">

          <ChartCard
            title="Temperature"
            dataKey="temperature"
            unit="°C"
            data={chartData}
          />

          <ChartCard
            title="Humidity"
            dataKey="humidity"
            unit="%"
            data={chartData}
          />

          <ChartCard
            title="Smoke Level"
            dataKey="smoke"
            unit="%"
            data={chartData}
          />

          <ChartCard
            title="Gas Level"
            dataKey="gas"
            unit="%"
            data={chartData}
          />

          <ChartCard
            title="Noise Level"
            dataKey="noise"
            unit="dB"
            data={chartData}
          />

        </div>
      </section>

      {/* ==================================================
          DEVICE OUTPUTS
      ================================================== */}

      <section className="monitor-section">

        <div className="section-heading">
          <div>
            <h2>
              Device Outputs
            </h2>

            <p>
              Current actuator status
            </p>
          </div>

          <span className="auto-mode-badge">
            AUTO MODE
          </span>
        </div>

        <div className="output-grid">

          <OutputCard
            title="Water Pump"
            value={telemetry.pump}
            icon={Waves}
          />

          <OutputCard
            title="Exhaust Fan"
            value={telemetry.fan}
            icon={Wind}
          />

          <OutputCard
            title="Safety Buzzer"
            value={telemetry.buzzer}
            icon={Bell}
          />

        </div>
      </section>

      {/* ==================================================
          DEVICE INFORMATION
      ================================================== */}

      <section className="monitor-section">

        <div className="section-heading">
          <div>
            <h2>
              Device Information
            </h2>

            <p>
              SafeHaven hardware connection
              details
            </p>
          </div>
        </div>

        <div className="device-information-grid">

          <div className="device-information-item">
            <span>
              Device ID
            </span>

            <strong>
              {DEVICE_ID}
            </strong>
          </div>

          <div className="device-information-item">
            <span>
              Connection
            </span>

            <strong>
              {isDeviceOnline
                ? "Wi-Fi Connected"
                : "Device Offline"}
            </strong>
          </div>

          <div className="device-information-item">
            <span>
              Signal Strength
            </span>

            <strong>
              {telemetry.wifiRSSI !== null
                ? `${telemetry.wifiRSSI} dBm`
                : "--"}
            </strong>
          </div>

          <div className="device-information-item">
            <span>
              Last Sync
            </span>

            <strong>
              {formatTime(
                lastSeen ||
                  telemetry.timestamp
              )}
            </strong>
          </div>

          <div className="device-information-item">
            <span>
              Operating Mode
            </span>

            <strong>
              Automatic
            </strong>
          </div>

          <div className="device-information-item">
            <span>
              Realtime Connection
            </span>

            <strong
              className={
                connected
                  ? "status-online"
                  : "status-offline"
              }
            >
              {connected
                ? "Connected"
                : "Disconnected"}
            </strong>
          </div>

        </div>
      </section>

      {/* ==================================================
          LOADING INDICATOR
      ================================================== */}

      {(loading ||
        historyLoading) && (
        <div className="monitor-loading">
          <Activity size={17} />

          Loading SafeHaven
          telemetry...
        </div>
      )}

    </div>
  );
}

export default LiveMonitoring;