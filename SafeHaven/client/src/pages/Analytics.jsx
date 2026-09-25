import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Droplets,
  Flame,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Volume2,
  Waves,
  Wind,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "../styles/analytics.css";

const DEVICE_ID = "SAFEHAVEN-001";

const TIME_RANGES = {
  "1H": 60,
  "6H": 360,
  "24H": 1440,
  "7D": 10080,
  "30D": 43200,
};

const SAFETY_COLORS = {
  SAFE: "#16A34A",
  WARNING: "#F59E0B",
  DANGER: "#DC2626",
};

function normalizeRecord(record, index) {
  return {
    ...record,
    id:
      record._id ||
      record.id ||
      `${record.timestamp || record.createdAt || "record"}-${index}`,

    deviceId: record.deviceId || DEVICE_ID,

    timestamp: record.timestamp || record.createdAt || null,

    temperature: Number(record.temperature ?? 0),
    humidity: Number(record.humidity ?? 0),
    smoke: Number(record.smoke ?? 0),
    gas: Number(record.gas ?? 0),
    noise: Number(record.noise ?? 0),
    fire: Number(record.fire ?? 0),

    safetyStatus: String(
      record.safetyStatus || record.status || "SAFE"
    ).toUpperCase(),

    safetyReason: record.safetyReason || "",

    pump: Boolean(record.pump),
    fan: Boolean(record.fan),
    buzzer: Boolean(record.buzzer),
    redLed: Boolean(record.redLed),
    greenLed: Boolean(record.greenLed),
  };
}

function formatTime(value) {
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

function formatUpdatedTime(value) {
  if (!value) return "No data";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No data";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTimeRangeStart(range) {
  const minutes = TIME_RANGES[range] || TIME_RANGES["1H"];
  return Date.now() - minutes * 60 * 1000;
}

function average(records, field) {
  if (!records.length) return 0;

  const total = records.reduce(
    (sum, record) => sum + Number(record[field] || 0),
    0
  );

  return total / records.length;
}

function formatNumber(value, decimals = 1) {
  return Number(value || 0).toFixed(decimals);
}

function getLatestRecord(records) {
  if (!records.length) return null;

  return [...records].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime()
  )[0];
}

function StatCard({
  icon: Icon,
  title,
  value,
  unit,
  description,
  type,
}) {
  return (
    <div className="analytics-stat-card">
      <div className={`analytics-stat-icon ${type}`}>
        <Icon size={21} />
      </div>

      <div className="analytics-stat-content">
        <span>{title}</span>

        <div className="analytics-stat-value">
          <strong>{value}</strong>

          {unit && <small>{unit}</small>}
        </div>

        <p>{description}</p>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="analytics-tooltip">
      <strong>{label}</strong>

      {payload.map((item) => {
        let unit = "";

        if (item.dataKey === "temperature") {
          unit = " °C";
        } else if (item.dataKey === "humidity") {
          unit = " %";
        } else if (
          item.dataKey === "smoke" ||
          item.dataKey === "gas"
        ) {
          unit = " %";
        } else if (item.dataKey === "noise") {
          unit = " dB";
        }

        return (
          <div
            key={item.dataKey}
            className="analytics-tooltip-row"
          >
            <span>{item.name}</span>

            <strong>
              {item.value}
              {unit}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function SensorPerformance({
  icon: Icon,
  name,
  value,
  range,
  percent,
  type,
}) {
  const safePercent = Math.min(
    100,
    Math.max(0, Number(percent || 0))
  );

  return (
    <div className="sensor-performance-card">
      <div className="sensor-performance-top">
        <div className={`sensor-performance-icon ${type}`}>
          <Icon size={18} />
        </div>

        <span>{name}</span>
      </div>

      <strong>{value}</strong>

      <p>{range}</p>

      <div className="performance-bar">
        <span
          className={type}
          style={{
            width: `${safePercent}%`,
          }}
        />
      </div>
    </div>
  );
}

function Analytics() {
  const [history, setHistory] = useState([]);
  const [range, setRange] = useState("1H");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get(
        `/devices/${DEVICE_ID}/history`,
        {
          params: {
            page: 1,
            limit: 500,
          },
        }
      );

      const rawData = response.data?.data;

      const items = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.items)
          ? rawData.items
          : [];

      const normalized = items
        .map(normalizeRecord)
        .filter((record) => record.timestamp)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() -
            new Date(b.timestamp).getTime()
        );

      setHistory(normalized);
    } catch (err) {
      console.error("Analytics history error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load analytics data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const filteredHistory = useMemo(() => {
    const start = getTimeRangeStart(range);

    return history.filter((record) => {
      const timestamp = new Date(record.timestamp).getTime();

      return (
        !Number.isNaN(timestamp) &&
        timestamp >= start &&
        timestamp <= Date.now()
      );
    });
  }, [history, range]);

  const latest = useMemo(
    () => getLatestRecord(filteredHistory),
    [filteredHistory]
  );

  const environmentData = useMemo(() => {
    return filteredHistory.map((record) => ({
      time: formatTime(record.timestamp),
      temperature: Number(record.temperature.toFixed(1)),
      humidity: Number(record.humidity.toFixed(1)),
    }));
  }, [filteredHistory]);

  const airQualityData = useMemo(() => {
    return filteredHistory.map((record) => ({
      time: formatTime(record.timestamp),
      smoke: Number(record.smoke.toFixed(1)),
      gas: Number(record.gas.toFixed(1)),
    }));
  }, [filteredHistory]);

  const noiseData = useMemo(() => {
    return filteredHistory.map((record) => ({
      time: formatTime(record.timestamp),
      noise: Number(record.noise.toFixed(1)),
    }));
  }, [filteredHistory]);

  const statistics = useMemo(() => {
    const total = filteredHistory.length;

    const safe = filteredHistory.filter(
      (record) => record.safetyStatus === "SAFE"
    ).length;

    const warning = filteredHistory.filter(
      (record) => record.safetyStatus === "WARNING"
    ).length;

    const danger = filteredHistory.filter(
      (record) => record.safetyStatus === "DANGER"
    ).length;

    const pumpActive = filteredHistory.filter(
      (record) => record.pump
    ).length;

    const fanActive = filteredHistory.filter(
      (record) => record.fan
    ).length;

    const buzzerActive = filteredHistory.filter(
      (record) => record.buzzer
    ).length;

    return {
      total,
      safe,
      warning,
      danger,
      pumpActive,
      fanActive,
      buzzerActive,
      avgTemperature: average(
        filteredHistory,
        "temperature"
      ),
      avgHumidity: average(filteredHistory, "humidity"),
      avgSmoke: average(filteredHistory, "smoke"),
      avgGas: average(filteredHistory, "gas"),
      avgNoise: average(filteredHistory, "noise"),
    };
  }, [filteredHistory]);

  const safetyDistribution = useMemo(() => {
    const total = statistics.total || 1;

    return [
      {
        name: "Safe",
        value: statistics.safe,
        percentage: (statistics.safe / total) * 100,
      },
      {
        name: "Warning",
        value: statistics.warning,
        percentage: (statistics.warning / total) * 100,
      },
      {
        name: "Danger",
        value: statistics.danger,
        percentage: (statistics.danger / total) * 100,
      },
    ];
  }, [statistics]);

  const actuatorData = useMemo(() => {
    return [
      {
        name: "Pump",
        active: statistics.pumpActive,
        inactive: Math.max(
          0,
          statistics.total - statistics.pumpActive
        ),
      },
      {
        name: "Exhaust",
        active: statistics.fanActive,
        inactive: Math.max(
          0,
          statistics.total - statistics.fanActive
        ),
      },
      {
        name: "Buzzer",
        active: statistics.buzzerActive,
        inactive: Math.max(
          0,
          statistics.total - statistics.buzzerActive
        ),
      },
    ];
  }, [statistics]);

  const getPercentage = (value, max) => {
    if (!max) return 0;

    return Math.min(
      100,
      Math.max(0, (value / max) * 100)
    );
  };

  const currentTemperature = latest?.temperature ?? 0;
  const currentHumidity = latest?.humidity ?? 0;
  const currentSmoke = latest?.smoke ?? 0;
  const currentGas = latest?.gas ?? 0;
  const currentNoise = latest?.noise ?? 0;
  const currentFire = latest?.fire ?? 0;

  return (
    <div className="analytics-page">
      {/* Header */}
      <header className="analytics-header">
        <div>
          <div className="analytics-title-row">
              <BarChart3 size={22} />

              <h1>Analytics</h1>
            </div>
              <p>
                Analyze sensor trends and system performance
              </p>
        </div>

        <button
          type="button"
          className={`analytics-refresh-button ${
            refreshing ? "refreshing" : ""
          }`}
          onClick={() => loadAnalytics(true)}
          disabled={refreshing}
        >
          <RefreshCw size={17} />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* Time Range */}
      <section className="analytics-toolbar">
        <div className="analytics-toolbar-left">
          <Clock3 size={17} />

          <span>Time Range</span>

          {Object.keys(TIME_RANGES).map((item) => (
            <button
              type="button"
              key={item}
              className={`time-range ${
                range === item ? "active" : ""
              }`}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="analytics-last-updated">
          {latest
            ? `Last reading ${formatUpdatedTime(
                latest.timestamp
              )}`
            : "No telemetry data"}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="analytics-error">
          <AlertTriangle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadAnalytics()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="analytics-loading">
          <RefreshCw
            size={22}
            className="analytics-loading-icon"
          />

          <span>Loading analytics data...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Statistics */}
          <section className="analytics-stat-grid">
            <StatCard
              icon={Thermometer}
              title="Average Temperature"
              value={formatNumber(
                statistics.avgTemperature
              )}
              unit="°C"
              description="Selected time period"
              type="blue"
            />

            <StatCard
              icon={Droplets}
              title="Average Humidity"
              value={formatNumber(
                statistics.avgHumidity
              )}
              unit="%"
              description="Selected time period"
              type="cyan"
            />

            <StatCard
              icon={Wind}
              title="Average Smoke"
              value={formatNumber(statistics.avgSmoke)}
              unit="%"
              description="Sensor scale: 0–100"
              type="purple"
            />

            <StatCard
              icon={ShieldAlert}
              title="Safety Events"
              value={statistics.warning + statistics.danger}
              description={`${statistics.warning} warnings • ${statistics.danger} danger`}
              type="orange"
            />
          </section>

          {/* Environment Chart */}
          <section className="analytics-chart-panel">
            <div className="analytics-panel-header">
              <div>
                <h2>Temperature & Humidity</h2>

                <p>
                  Environmental conditions over the selected
                  period
                </p>
              </div>

              <div className="analytics-chart-legend">
                <span>
                  <i className="legend-dot temperature" />
                  Temperature
                </span>

                <span>
                  <i className="legend-dot humidity" />
                  Humidity
                </span>
              </div>
            </div>

            <div className="analytics-chart-container">
              {environmentData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={environmentData}
                    margin={{
                      top: 10,
                      right: 20,
                      left: -10,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E2E8F0"
                    />

                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "#64748B",
                      }}
                    />

                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "#64748B",
                      }}
                    />

                    <Tooltip
                      content={<ChartTooltip />}
                    />

                    <Line
                      type="monotone"
                      dataKey="temperature"
                      name="Temperature"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity"
                      stroke="#06B6D4"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
          </section>

          {/* Two Column Charts */}
          <section className="analytics-two-column">
            {/* Smoke + Gas */}
            <div className="analytics-chart-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>Smoke & Gas</h2>

                  <p>
                    Air quality sensor trends
                  </p>
                </div>

                <div className="analytics-mini-status">
                  <span />

                  {latest &&
                  (latest.smoke >= 70 ||
                    latest.gas >= 70)
                    ? "Danger"
                    : latest &&
                        (latest.smoke >= 40 ||
                          latest.gas >= 40)
                      ? "Warning"
                      : "Normal"}
                </div>
              </div>

              <div className="analytics-small-chart">
                {airQualityData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={airQualityData}
                      margin={{
                        top: 10,
                        right: 15,
                        left: -15,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="smokeGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#8B5CF6"
                            stopOpacity={0.25}
                          />

                          <stop
                            offset="95%"
                            stopColor="#8B5CF6"
                            stopOpacity={0}
                          />
                        </linearGradient>

                        <linearGradient
                          id="gasGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#F59E0B"
                            stopOpacity={0.25}
                          />

                          <stop
                            offset="95%"
                            stopColor="#F59E0B"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />

                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748B",
                        }}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748B",
                        }}
                      />

                      <Tooltip
                        content={<ChartTooltip />}
                      />

                      <Area
                        type="monotone"
                        dataKey="smoke"
                        name="Smoke"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        fill="url(#smokeGradient)"
                      />

                      <Area
                        type="monotone"
                        dataKey="gas"
                        name="Gas"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        fill="url(#gasGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>

              <div className="analytics-chart-bottom">
                <span>
                  <i className="legend-dot smoke" />
                  Smoke
                </span>

                <span>
                  <i className="legend-dot gas" />
                  Gas
                </span>

                <small>Scale: 0–100%</small>
              </div>
            </div>

            {/* Noise */}
            <div className="analytics-chart-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>Noise Level</h2>

                  <p>
                    Ambient sound monitoring
                  </p>
                </div>

                <div className="noise-current">
                  <Volume2 size={15} />

                  {formatNumber(currentNoise)} dB
                </div>
              </div>

              <div className="analytics-small-chart">
                {noiseData.length > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <AreaChart
                      data={noiseData}
                      margin={{
                        top: 10,
                        right: 15,
                        left: -15,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="noiseGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#16A34A"
                            stopOpacity={0.22}
                          />

                          <stop
                            offset="95%"
                            stopColor="#16A34A"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />

                      <XAxis
                        dataKey="time"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748B",
                        }}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748B",
                        }}
                      />

                      <Tooltip
                        content={<ChartTooltip />}
                      />

                      <Area
                        type="monotone"
                        dataKey="noise"
                        name="Noise"
                        stroke="#16A34A"
                        strokeWidth={2}
                        fill="url(#noiseGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>

              <div className="noise-limit">
                <span>Warning threshold</span>

                <strong>50 dB</strong>

                <span>Danger threshold</span>

                <strong>80 dB</strong>
              </div>
            </div>
          </section>

          {/* Bottom Charts */}
          <section className="analytics-bottom-grid">
            {/* Safety Distribution */}
            <div className="analytics-chart-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>Safety Distribution</h2>

                  <p>
                    System status distribution
                  </p>
                </div>
              </div>

              <div className="safety-chart-area">
                <div className="safety-pie">
                  {statistics.total > 0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={safetyDistribution}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={78}
                          paddingAngle={3}
                          stroke="none"
                        >
                          <Cell
                            fill={SAFETY_COLORS.SAFE}
                          />

                          <Cell
                            fill={SAFETY_COLORS.WARNING}
                          />

                          <Cell
                            fill={SAFETY_COLORS.DANGER}
                          />
                        </Pie>

                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="pie-empty">
                      No data
                    </div>
                  )}

                  {statistics.total > 0 && (
                    <div className="pie-center">
                      <strong>
                        {formatNumber(
                          (statistics.safe /
                            statistics.total) *
                            100
                        )}
                        %
                      </strong>

                      <span>Safe</span>
                    </div>
                  )}
                </div>

                <div className="safety-legend">
                  {safetyDistribution.map((item) => (
                    <div key={item.name}>
                      <span>
                        <i
                          className={`${item.name.toLowerCase()}-dot`}
                        />

                        {item.name}
                      </span>

                      <strong>
                        {statistics.total
                          ? `${formatNumber(
                              item.percentage
                            )}%`
                          : "0%"}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actuator Activity */}
            <div className="analytics-chart-panel">
              <div className="analytics-panel-header">
                <div>
                  <h2>Actuator Activity</h2>

                  <p>
                    Device activity during selected period
                  </p>
                </div>
              </div>

              <div className="actuator-chart">
                {statistics.total > 0 ? (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={actuatorData}
                      margin={{
                        top: 10,
                        right: 10,
                        left: -15,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E2E8F0"
                      />

                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#64748B",
                        }}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 9,
                          fill: "#64748B",
                        }}
                      />

                      <Tooltip />

                      <Legend />

                      <Bar
                        dataKey="active"
                        name="Active"
                        fill="#2563EB"
                        radius={[5, 5, 0, 0]}
                      />

                      <Bar
                        dataKey="inactive"
                        name="Inactive"
                        fill="#CBD5E1"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState />
                )}
              </div>
            </div>
          </section>

          {/* Sensor Summary */}
          <section className="analytics-sensor-summary">
            <div className="analytics-summary-header">
              <div>
                <h2>Sensor Performance</h2>

                <p>
                  Current readings compared with configured
                  thresholds
                </p>
              </div>

              <span className="threshold-info">
                Based on SafeHaven thresholds
              </span>
            </div>

            <div className="sensor-performance-grid">
              <SensorPerformance
                icon={Thermometer}
                name="Temperature"
                value={`${formatNumber(
                  currentTemperature
                )} °C`}
                range="Warning: 40 °C • Danger: 45 °C"
                percent={getPercentage(
                  currentTemperature,
                  45
                )}
                type="blue"
              />

              <SensorPerformance
                icon={Waves}
                name="Humidity"
                value={`${formatNumber(
                  currentHumidity
                )}%`}
                range="Warning: 60% • Danger: 80%"
                percent={getPercentage(
                  currentHumidity,
                  80
                )}
                type="cyan"
              />

              <SensorPerformance
                icon={Wind}
                name="Smoke"
                value={`${formatNumber(currentSmoke)}%`}
                range="Warning: 40% • Danger: 70%"
                percent={getPercentage(
                  currentSmoke,
                  70
                )}
                type="purple"
              />

              <SensorPerformance
                icon={Gauge}
                name="Gas"
                value={`${formatNumber(currentGas)}%`}
                range="Warning: 40% • Danger: 70%"
                percent={getPercentage(currentGas, 70)}
                type="orange"
              />

              <SensorPerformance
                icon={Volume2}
                name="Noise"
                value={`${formatNumber(currentNoise)} dB`}
                range="Warning: 50 dB • Danger: 80 dB"
                percent={getPercentage(
                  currentNoise,
                  80
                )}
                type="green"
              />

              <SensorPerformance
                icon={Flame}
                name="Fire"
                value={
                  currentFire >= 70
                    ? "DANGER"
                    : currentFire >= 50
                      ? "WARNING"
                      : "SAFE"
                }
                range={`Sensor value: ${formatNumber(
                  currentFire
                )}%`}
                percent={getPercentage(
                  currentFire,
                  70
                )}
                type="red"
              />
            </div>
          </section>

          {/* Data information */}
          <div className="analytics-data-footer">
            <div>
              <Activity size={16} />

              <span>
                {filteredHistory.length} telemetry records
                loaded for {range}
              </span>
            </div>

            <div>
              <CheckCircle2 size={16} />

              <span>
                Device: {DEVICE_ID}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="analytics-empty-chart">
      <BarChart3 size={28} />

      <strong>No telemetry data</strong>

      <span>
        No records are available for the selected time
        range.
      </span>
    </div>
  );
}

export default Analytics;