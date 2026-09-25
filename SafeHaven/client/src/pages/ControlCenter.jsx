import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CirclePower,
  Fan,
  Gauge,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Waves,
  Wifi,
  Zap,
} from "lucide-react";

import api from "../services/api";
import "../styles/control-center.css";

const DEVICE_ID = "SAFEHAVEN-001";

const INITIAL_ACTIVITY = [];

/* ==========================================================
   TELEMETRY NORMALIZATION
========================================================== */

function normalizeTelemetry(record) {
  return {
    ...record,

    deviceId: record?.deviceId || DEVICE_ID,

    timestamp:
      record?.timestamp ||
      record?.createdAt ||
      null,

    temperature: Number(record?.temperature ?? 0),
    humidity: Number(record?.humidity ?? 0),
    smoke: Number(record?.smoke ?? 0),
    gas: Number(record?.gas ?? 0),
    noise: Number(record?.noise ?? 0),
    fire: Number(record?.fire ?? 0),

    safetyStatus: String(
      record?.safetyStatus ||
        record?.status ||
        "SAFE"
    ).toUpperCase(),

    safetyReason: record?.safetyReason || "",

    pump: Boolean(record?.pump),
    fan: Boolean(record?.fan),
    buzzer: Boolean(record?.buzzer),
    redLed: Boolean(record?.redLed),
    greenLed: Boolean(record?.greenLed),

    wifiRSSI:
      record?.wifiRSSI !== undefined &&
      record?.wifiRSSI !== null
        ? Number(record.wifiRSSI)
        : null,
  };
}

/* ==========================================================
   DATE + TIME FORMAT
========================================================== */

function formatDateTime(value) {
  if (!value) return "--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const datePart = date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${datePart} • ${timePart}`;
}

/* ==========================================================
   SAFETY HELPERS
========================================================== */

function getSafetyDescription(status, reason) {
  if (status === "DANGER") {
    return (
      reason ||
      "One or more monitored parameters are in danger range."
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
    "All monitored parameters are currently within configured safety limits."
  );
}

function getSafetyClass(status) {
  if (status === "DANGER") return "danger";
  if (status === "WARNING") return "warning";
  return "safe";
}

/* ==========================================================
   ACTIVITY HELPERS
========================================================== */

function getActivityType(status) {
  const normalizedStatus = String(
    status || "INFO"
  ).toUpperCase();

  if (normalizedStatus === "FAILED") {
    return "warning";
  }

  if (normalizedStatus === "SUCCESS") {
    return "success";
  }

  if (normalizedStatus === "PENDING") {
    return "warning";
  }

  return "info";
}

function getActivityStatusClass(status) {
  const normalizedStatus = String(
    status || "INFO"
  ).toUpperCase();

  if (normalizedStatus === "SUCCESS") {
    return "success";
  }

  if (normalizedStatus === "FAILED") {
    return "failed";
  }

  if (normalizedStatus === "PENDING") {
    return "pending";
  }

  return "info";
}

function getModeLabel(mode) {
  if (!mode) return "—";

  return String(mode).toUpperCase();
}

function getSourceLabel(source) {
  if (!source) return "—";

  const normalized = String(source).toUpperCase();

  if (normalized === "USER") return "USER";
  if (normalized === "MANUAL") return "MANUAL";
  if (normalized === "AUTOMATION") return "AUTOMATION";
  if (normalized === "ESP32") return "ESP32";
  if (normalized === "SYSTEM") return "SYSTEM";

  return normalized;
}

/* ==========================================================
   CONTROL CARD
========================================================== */

function ControlCard({
  icon: Icon,
  title,
  description,
  status,
  enabled,
  onToggle,
  disabled,
  type,
}) {
  return (
    <div
      className={`control-device-card ${
        enabled ? "enabled" : ""
      }`}
    >
      <div className="control-device-top">
        <div className={`control-device-icon ${type}`}>
          <Icon size={22} />
        </div>

        <div className="control-device-heading">
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        <span
          className={`control-device-status ${
            enabled ? "on" : "off"
          }`}
        >
          {enabled ? "ON" : "OFF"}
        </span>
      </div>

      <div className="control-device-divider" />

      <div className="control-device-bottom">
        <div className="control-device-state">
          <span>Current State</span>
          <strong>{status}</strong>
        </div>

        <button
          type="button"
          className={`control-toggle ${
            enabled ? "active" : ""
          }`}
          onClick={onToggle}
          disabled={disabled}
          aria-label={`Toggle ${title}`}
        >
          <span />
        </button>
      </div>

      {disabled && (
        <div className="control-disabled-note">
          <Lock size={12} />

          {/*
            AUTO mode मध्ये manual control disabled आहे.
            Disconnected device साठी actual popup
            updateActuator() मधून दाखवला जातो.
          */}
          Manual control unavailable in AUTO mode
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   CONTROL CENTER
========================================================== */

function ControlCenter() {
  const [mode, setMode] = useState("AUTO");

  const [telemetry, setTelemetry] = useState(null);

  const [activities, setActivities] = useState(
    INITIAL_ACTIVITY
  );

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [commandLoading, setCommandLoading] =
    useState(false);

  const [error, setError] = useState("");

  /* ========================================================
     ACTIVITY PAGINATION
  ======================================================== */

  const [activityPageSize, setActivityPageSize] =
    useState(10);

  const [activityPage, setActivityPage] =
    useState(1);

  /* ========================================================
     LOAD LATEST TELEMETRY
  ======================================================== */

  const loadLatest = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      }

      setError("");

      const response = await api.get(
        `/devices/${DEVICE_ID}/latest`
      );

      const raw =
        response.data?.data ||
        response.data?.telemetry ||
        response.data;

      if (raw) {
        setTelemetry(normalizeTelemetry(raw));
      }
    } catch (err) {
      console.error(
        "Control Center telemetry error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to load device telemetry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /* ========================================================
     LOAD DATABASE ACTIVITIES

     IMPORTANT:
     - Backend मधून सर्व available records fetch केले जातात.
     - UI pagination नंतर लागू होते.
     - त्यामुळे 10 select केले म्हणून DB मधून फक्त
       10 records येत नाहीत.
  ======================================================== */

  const loadActivity = async () => {
    try {
      const response = await api.get(
        `/activity/${DEVICE_ID}?limit=500`
      );

      const records =
        response.data?.data || [];

      if (!Array.isArray(records)) {
        setActivities([]);
        return;
      }

      const mappedActivities = records
        .map((activity) => {
          const timestamp =
            activity?.timestamp ||
            activity?.createdAt ||
            activity?.updatedAt ||
            null;

          const status = String(
            activity?.status || "INFO"
          ).toUpperCase();

          return {
            id:
              activity?._id ||
              activity?.id ||
              `${timestamp}-${activity?.action || "activity"}`,

            title:
              activity?.title ||
              activity?.action ||
              "System activity",

            description:
              activity?.description || "",

            status,

            statusClass:
              getActivityStatusClass(status),

            type:
              getActivityType(status),

            mode:
              activity?.mode || null,

            source:
              activity?.source || "SYSTEM",

            timestamp,

            dateTime:
              formatDateTime(timestamp),

            commandId:
              activity?.commandId || null,
          };
        })
        .sort((a, b) => {
          const aTime = a.timestamp
            ? new Date(a.timestamp).getTime()
            : 0;

          const bTime = b.timestamp
            ? new Date(b.timestamp).getTime()
            : 0;

          return bTime - aTime;
        });

      setActivities(mappedActivities);

      /*
       * New data आली की current page valid ठेवायचा.
       */
      setActivityPage((currentPage) => {
        const totalPages = Math.max(
          1,
          Math.ceil(
            mappedActivities.length /
              activityPageSize
          )
        );

        return Math.min(
          currentPage,
          totalPages
        );
      });
    } catch (err) {
      console.error(
        "Control Center activity error:",
        err
      );
    }
  };

  /* ========================================================
     INITIAL LOAD + AUTO REFRESH
  ======================================================== */

  useEffect(() => {
    loadLatest();
    loadActivity();

    const telemetryInterval = setInterval(() => {
      loadLatest(false);
    }, 5000);

    const activityInterval = setInterval(() => {
      loadActivity();
    }, 5000);

    return () => {
      clearInterval(telemetryInterval);
      clearInterval(activityInterval);
    };
  }, []);

  /* ========================================================
     ACTIVITY PAGINATION DERIVED DATA
  ======================================================== */

  const totalActivities = activities.length;

  const totalActivityPages = Math.max(
    1,
    Math.ceil(
      totalActivities / activityPageSize
    )
  );

  const safeActivityPage = Math.min(
    activityPage,
    totalActivityPages
  );

  const activityStartIndex =
    (safeActivityPage - 1) *
    activityPageSize;

  const activityEndIndex =
    Math.min(
      activityStartIndex +
        activityPageSize,
      totalActivities
    );

  const visibleActivities =
    activities.slice(
      activityStartIndex,
      activityEndIndex
    );

  /* ========================================================
     CHANGE ACTIVITY PAGE SIZE
  ======================================================== */

  const changeActivityPageSize = (value) => {
    const newSize = Number(value);

    setActivityPageSize(newSize);

    /*
     * Page size बदलल्यावर पहिल्या page वर येणे.
     */
    setActivityPage(1);
  };

  /* ========================================================
     PREVIOUS ACTIVITY PAGE
  ======================================================== */

  const goToPreviousActivityPage = () => {
    setActivityPage((currentPage) =>
      Math.max(1, currentPage - 1)
    );
  };

  /* ========================================================
     NEXT ACTIVITY PAGE
  ======================================================== */

  const goToNextActivityPage = () => {
    setActivityPage((currentPage) =>
      Math.min(
        totalActivityPages,
        currentPage + 1
      )
    );
  };

  /* ========================================================
     RECORD ACTIVITY
  ======================================================== */

  const recordActivity = async ({
    type,
    action,
    title,
    description,
    status = "INFO",
    mode: activityMode = null,
    metadata = {},
    commandId = null,
    source = "USER",
  }) => {
    try {
      await api.post("/activity", {
        deviceId: DEVICE_ID,

        type,

        action,

        title,

        description,

        status,

        mode: activityMode,

        source,

        commandId,

        metadata,
      });

      await loadActivity();
    } catch (err) {
      console.error(
        "Control Center record activity error:",
        err
      );

      throw err;
    }
  };

  /* ========================================================
     CHECK ESP32 CONNECTION
  ======================================================== */

  const checkDeviceConnected = async () => {
    try {
      const response = await api.get(
        `/devices/${DEVICE_ID}/status`
      );

      const data =
        response.data?.data ||
        response.data ||
        {};

      const status = String(
        data?.status ||
          data?.deviceStatus ||
          ""
      ).toUpperCase();

      /*
       * Backend responses:
       *
       * connected: true
       * isOnline: true
       * status: ONLINE
       * status: CONNECTED
       */

      const connected =
        data?.connected === true ||
        data?.isOnline === true ||
        status === "ONLINE" ||
        status === "CONNECTED";

      return connected;
    } catch (err) {
      console.error(
        "Device connection check error:",
        err
      );

      /*
       * Status API fail झाली तर
       * सुरक्षित बाजूने disconnected.
       */
      return false;
    }
  };

  /* ========================================================
     SEND COMMAND
  ======================================================== */

  const sendCommand = async (command) => {
    return api.post("/commands", {
      deviceId: DEVICE_ID,

      command,

      source: "MANUAL",

      mode: "MANUAL",

      priority: "NORMAL",
    });
  };

  /* ========================================================
     CHANGE MODE
  ======================================================== */

  const changeMode = async (newMode) => {
    if (mode === newMode) {
      return;
    }

    const previousMode = mode;

    try {
      setError("");

      setMode(newMode);

      await recordActivity({
        type: "MODE_CHANGE",

        action:
          newMode === "AUTO"
            ? "AUTO_MODE_ENABLED"
            : "MANUAL_MODE_ENABLED",

        title:
          newMode === "AUTO"
            ? "System switched to Automatic mode"
            : "System switched to Manual mode",

        description:
          newMode === "AUTO"
            ? "Automatic safety control has been restored."
            : "Manual actuator control has been enabled.",

        status: "SUCCESS",

        mode: newMode,

        source: "USER",

        metadata: {
          previousMode,
          newMode,
        },
      });
    } catch (err) {
      setMode(previousMode);

      setError(
        err.response?.data?.message ||
          "Unable to save operation mode activity."
      );
    }
  };

  /* ========================================================
     MANUAL ACTUATOR COMMAND
  ======================================================== */

  const updateActuator = async (
    actuator,
    nextValue,
    label
  ) => {
    /* ------------------------------------------------------
       AUTO MODE
    ------------------------------------------------------ */

    if (mode === "AUTO") {
      window.alert(
        "Manual control is disabled while the system is in AUTO mode."
      );

      return;
    }

    /* ------------------------------------------------------
       COMMAND ALREADY RUNNING
    ------------------------------------------------------ */

    if (commandLoading) {
      return;
    }

    try {
      setCommandLoading(true);

      setError("");

      /* ----------------------------------------------------
         CHECK DEVICE CONNECTION BEFORE COMMAND
      ---------------------------------------------------- */

      const connected =
        await checkDeviceConnected();

      /* ----------------------------------------------------
         DEVICE DISCONNECTED
      ---------------------------------------------------- */

      if (!connected) {
        /*
         * IMPORTANT:
         *
         * येथे command API call होणार नाही.
         *
         * त्यामुळे MongoDB commands collection मध्ये
         * चुकीचा command तयार होणार नाही.
         *
         * Activity collection मध्येही manual action
         * record होणार नाही.
         *
         * Hardware ON/OFF होणार नाही.
         */

        window.alert(
          `ESP32_Unit is disconnected.\n\n${label} cannot be turned ${
            nextValue ? "ON" : "OFF"
          } until the device is connected.`
        );

        /*
         * Backend latest state refresh.
         */
        await loadLatest(false);

        return;
      }

      /* ----------------------------------------------------
         BUILD COMMAND
      ---------------------------------------------------- */

      let commandName = "";

      if (actuator === "pump") {
        commandName = nextValue
          ? "PUMP_ON"
          : "PUMP_OFF";
      }

      if (actuator === "fan") {
        commandName = nextValue
          ? "FAN_ON"
          : "FAN_OFF";
      }

      if (actuator === "buzzer") {
        commandName = nextValue
          ? "BUZZER_ON"
          : "BUZZER_OFF";
      }

      if (!commandName) {
        throw new Error(
          "Invalid actuator command."
        );
      }

      /* ----------------------------------------------------
         SEND COMMAND
      ---------------------------------------------------- */

      await sendCommand(commandName);

      /*
       * Frontend स्वतः state बदलत नाही.
       *
       * ESP32 command execute करेल.
       * नंतर telemetry मधून actual state येईल.
       */

      setTimeout(() => {
        loadLatest(false);
        loadActivity();
      }, 1500);
    } catch (err) {
      console.error(
        "Actuator command error:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.message ||
          `Unable to control ${label}.`
      );

      loadActivity();
    } finally {
      setCommandLoading(false);
    }
  };

  /* ========================================================
     ACTUATOR HANDLERS
  ======================================================== */

  const togglePump = () => {
    updateActuator(
      "pump",
      !Boolean(telemetry?.pump),
      "Water Pump"
    );
  };

  const toggleFan = () => {
    updateActuator(
      "fan",
      !Boolean(telemetry?.fan),
      "Exhaust Fan"
    );
  };

  const toggleBuzzer = () => {
    updateActuator(
      "buzzer",
      !Boolean(telemetry?.buzzer),
      "Safety Buzzer"
    );
  };

  /* ========================================================
     DERIVED DATA
  ======================================================== */

  const safetyStatus = useMemo(
    () =>
      String(
        telemetry?.safetyStatus || "SAFE"
      ).toUpperCase(),
    [telemetry]
  );

  const safetyClass =
    getSafetyClass(safetyStatus);

  const safetyDescription =
    getSafetyDescription(
      safetyStatus,
      telemetry?.safetyReason
    );

  const pump = Boolean(telemetry?.pump);
  const fan = Boolean(telemetry?.fan);
  const buzzer = Boolean(telemetry?.buzzer);

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="control-page">

      {/* ====================================================
          HEADER
      ==================================================== */}

      <header className="control-header">
        <div>
          <div className="control-title-row">
            <SlidersHorizontal size={22} />

            <h1>Control Center</h1>
          </div>

          <p>
            Manage SafeHaven devices and automation
          </p>
        </div>

        <div className="control-header-actions">
          <button
            type="button"
            className="control-refresh-button"
            onClick={() => {
              loadLatest(true);
              loadActivity();
            }}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing ? "spinning" : ""
              }
            />

            <span>
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </span>
          </button>
        </div>
      </header>

      {/* ====================================================
          ERROR
      ==================================================== */}

      {error && (
        <div className="control-error">
          <AlertTriangle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => {
              setError("");
              loadLatest(false);
              loadActivity();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ====================================================
          INITIAL LOADING
      ==================================================== */}

      {loading && !telemetry && (
        <div className="control-loading">
          <RefreshCw
            size={22}
            className="spinning"
          />

          <span>
            Loading SafeHaven device status...
          </span>
        </div>
      )}

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

      {!loading || telemetry ? (
        <>
          {/* =================================================
              SAFETY STATUS
          ================================================= */}

          <section
            className={`control-safety-banner ${safetyClass}`}
          >
            <div className="control-safety-icon">
              {safetyStatus === "DANGER" ? (
                <ShieldAlert size={25} />
              ) : safetyStatus === "WARNING" ? (
                <AlertTriangle size={25} />
              ) : (
                <Shield size={25} />
              )}
            </div>

            <div className="control-safety-text">
              <strong>
                System Safety Status:{" "}
                {safetyStatus}
              </strong>

              <span>
                {safetyDescription}
              </span>
            </div>

            <div className="control-safety-reading">
              <div>
                <span>Temperature</span>

                <strong>
                  {Number(
                    telemetry?.temperature ?? 0
                  ).toFixed(1)}{" "}
                  °C
                </strong>
              </div>

              <div>
                <span>Smoke</span>

                <strong>
                  {Number(
                    telemetry?.smoke ?? 0
                  ).toFixed(0)}
                  %
                </strong>
              </div>

              <div>
                <span>Gas</span>

                <strong>
                  {Number(
                    telemetry?.gas ?? 0
                  ).toFixed(0)}
                  %
                </strong>
              </div>
            </div>
          </section>

          {/* =================================================
              MODE
          ================================================= */}

          <section className="control-mode-panel">
            <div className="control-mode-heading">
              <div className="control-section-icon">
                <CirclePower size={20} />
              </div>

              <div>
                <h2>Operation Mode</h2>

                <p>
                  Choose how the safety actuators should
                  operate.
                </p>
              </div>
            </div>

            <div className="control-mode-selector">

              <button
                type="button"
                className={`mode-button ${
                  mode === "AUTO"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  changeMode("AUTO")
                }
              >
                <Zap size={18} />

                <div>
                  <strong>Automatic</strong>

                  <span>
                    System controls devices based on
                    sensor conditions
                  </span>
                </div>

                {mode === "AUTO" && (
                  <CheckCircle2 size={19} />
                )}
              </button>

              <button
                type="button"
                className={`mode-button ${
                  mode === "MANUAL"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  changeMode("MANUAL")
                }
              >
                <SlidersHorizontal size={18} />

                <div>
                  <strong>Manual</strong>

                  <span>
                    Operator controls connected devices
                    directly
                  </span>
                </div>

                {mode === "MANUAL" && (
                  <CheckCircle2 size={19} />
                )}
              </button>

            </div>
          </section>

          {/* =================================================
              DEVICE CONTROLS
          ================================================= */}

          <div className="control-section-title">
            <div>
              <h2>Device Controls</h2>

              <p>
                Control connected safety actuators
              </p>
            </div>

            <span className="control-mode-badge">
              {mode} MODE
            </span>
          </div>

          <section className="control-device-grid">

            <ControlCard
              icon={Waves}
              title="Water Pump"
              description="Fire suppression water pump"
              status={
                pump
                  ? "Running"
                  : "Standby"
              }
              enabled={pump}
              onToggle={togglePump}
              disabled={
                mode === "AUTO" ||
                commandLoading
              }
              type="blue"
            />

            <ControlCard
              icon={Fan}
              title="Exhaust Fan"
              description="Gas and smoke ventilation"
              status={
                fan
                  ? "Running"
                  : "Standby"
              }
              enabled={fan}
              onToggle={toggleFan}
              disabled={
                mode === "AUTO" ||
                commandLoading
              }
              type="cyan"
            />

            <ControlCard
              icon={BellRing}
              title="Safety Buzzer"
              description="Emergency audible warning"
              status={
                buzzer
                  ? "Active"
                  : "Inactive"
              }
              enabled={buzzer}
              onToggle={toggleBuzzer}
              disabled={
                mode === "AUTO" ||
                commandLoading
              }
              type="red"
            />

          </section>

          {/* =================================================
              AUTOMATION
          ================================================= */}

          <section className="control-automation-panel">
            <div className="control-automation-heading">
              <div className="control-section-icon green">
                <Zap size={19} />
              </div>

              <div>
                <h2>Safety Automation</h2>

                <p>
                  Automatic response rules remain active
                  while the system is in AUTO mode.
                </p>
              </div>
            </div>

            <div className="automation-rules">

              <div className="automation-rule">
                <div className="automation-rule-icon fire">
                  <ShieldAlert size={17} />
                </div>

                <div>
                  <strong>
                    Fire detected
                  </strong>

                  <span>
                    Water pump → ON
                  </span>
                </div>

                <span className="rule-active">
                  ACTIVE
                </span>
              </div>

              <div className="automation-rule">
                <div className="automation-rule-icon gas">
                  <Fan size={17} />
                </div>

                <div>
                  <strong>
                    Smoke / Gas danger
                  </strong>

                  <span>
                    Exhaust fan → ON
                  </span>
                </div>

                <span className="rule-active">
                  ACTIVE
                </span>
              </div>

              <div className="automation-rule">
                <div className="automation-rule-icon alert">
                  <AlertTriangle size={17} />
                </div>

                <div>
                  <strong>
                    Overall danger
                  </strong>

                  <span>
                    Buzzer + Red LED → ON
                  </span>
                </div>

                <span className="rule-active">
                  ACTIVE
                </span>
              </div>

            </div>
          </section>

          {/* =================================================
              SAFETY OVERRIDE
          ================================================= */}

          <section className="control-override-panel">
            <div className="override-info">
              <div className="override-icon">
                <Shield size={19} />
              </div>

              <div>
                <strong>
                  Safety Override
                </strong>

                <p>
                  Backend safety automation takes priority
                  whenever a dangerous condition is detected.
                </p>
              </div>
            </div>

            <div className="override-status">
              <CheckCircle2 size={16} />

              <span>ACTIVE</span>
            </div>
          </section>

          {/* =================================================
              DATABASE ACTIVITY TABLE
          ================================================= */}

          <section className="control-activity-panel">

            <div className="control-panel-header">
              <div>
                <h2>
                  Control Activity
                </h2>

                <p>
                  Complete activity history stored in
                  the database
                </p>
              </div>

              <Activity size={18} />
            </div>

            {/* =================================================
                ACTIVITY DISPLAY CONTROLS

                DB मधील records बदलत नाहीत.
                फक्त UI वर किती rows दाखवायच्या ते control.
            ================================================= */}

            {activities.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "12px 16px",
                  borderBottom:
                    "1px solid var(--color-border)",
                  background: "#f8fafc",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <span>Show</span>

                  <select
                    value={activityPageSize}
                    onChange={(event) =>
                      changeActivityPageSize(
                        event.target.value
                      )
                    }
                    style={{
                      height: "32px",
                      padding: "0 30px 0 10px",
                      border:
                        "1px solid var(--color-border)",
                      borderRadius: "7px",
                      background:
                        "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value={10}>
                      10
                    </option>

                    <option value={20}>
                      20
                    </option>

                    <option value={50}>
                      50
                    </option>
                  </select>

                  <span>
                    rows
                  </span>
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Showing{" "}
                  <strong
                    style={{
                      color:
                        "var(--color-text)",
                    }}
                  >
                    {totalActivities === 0
                      ? 0
                      : activityStartIndex + 1}
                    –
                    {activityEndIndex}
                  </strong>{" "}
                  of{" "}
                  <strong
                    style={{
                      color:
                        "var(--color-text)",
                    }}
                  >
                    {totalActivities}
                  </strong>{" "}
                  activities
                </div>
              </div>
            )}

            <div className="control-activity-table-wrapper">

              {activities.length === 0 ? (
                <div className="control-empty-activity">
                  <Activity size={20} />

                  <span>
                    No activities found in database.
                  </span>
                </div>
              ) : (
                <table className="control-activity-table">

                  <thead>
                    <tr>
                      {/* DATE + TIME ONE COLUMN */}
                      <th>
                        Date &amp; Time
                      </th>

                      <th>
                        Activity
                      </th>

                      <th>
                        Mode
                      </th>

                      <th>
                        Source
                      </th>

                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleActivities.map(
                      (activity) => (
                        <tr
                          key={activity.id}
                        >

                          {/* DATE + TIME */}

                          <td>
                            <span
                              className="activity-date"
                              style={{
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {activity.dateTime}
                            </span>
                          </td>

                          {/* ACTIVITY */}

                          <td>
                            <div className="activity-table-title">

                              <div
                                className={`activity-icon ${activity.type}`}
                              >
                                {activity.type ===
                                "warning" ? (
                                  <AlertTriangle
                                    size={14}
                                  />
                                ) : activity.type ===
                                  "success" ? (
                                  <CheckCircle2
                                    size={14}
                                  />
                                ) : (
                                  <Activity
                                    size={14}
                                  />
                                )}
                              </div>

                              <div>
                                <strong>
                                  {activity.title}
                                </strong>

                                {activity.description && (
                                  <span>
                                    {
                                      activity.description
                                    }
                                  </span>
                                )}
                              </div>

                            </div>
                          </td>

                          {/* MODE */}

                          <td>
                            <span
                              className={`activity-mode-badge ${
                                String(
                                  activity.mode || ""
                                ).toLowerCase()
                              }`}
                            >
                              {getModeLabel(
                                activity.mode
                              )}
                            </span>
                          </td>

                          {/* SOURCE */}

                          <td>
                            <span
                              className={`activity-source-badge ${
                                String(
                                  activity.source || ""
                                ).toLowerCase()
                              }`}
                            >
                              {getSourceLabel(
                                activity.source
                              )}
                            </span>
                          </td>

                          {/* STATUS */}

                          <td>
                            <span
                              className={`activity-status-badge ${activity.statusClass}`}
                            >
                              {activity.status}
                            </span>
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>
              )}

            </div>

            {/* =================================================
                PAGINATION
            ================================================= */}

            {activities.length > 0 &&
              totalActivityPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    padding: "14px 16px",
                    borderTop:
                      "1px solid var(--color-border)",
                    background:
                      "var(--color-surface)",
                  }}
                >
                  <button
                    type="button"
                    onClick={
                      goToPreviousActivityPage
                    }
                    disabled={
                      safeActivityPage === 1
                    }
                    style={{
                      minWidth: "90px",
                      height: "34px",
                      padding: "0 12px",
                      border:
                        "1px solid var(--color-border)",
                      borderRadius: "7px",
                      background:
                        safeActivityPage === 1
                          ? "#f1f5f9"
                          : "#ffffff",
                      color:
                        safeActivityPage === 1
                          ? "#94a3b8"
                          : "#334155",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor:
                        safeActivityPage === 1
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Previous
                  </button>

                  <span
                    style={{
                      minWidth: "90px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                      color:
                        "var(--color-text)",
                    }}
                  >
                    Page{" "}
                    {safeActivityPage} of{" "}
                    {totalActivityPages}
                  </span>

                  <button
                    type="button"
                    onClick={
                      goToNextActivityPage
                    }
                    disabled={
                      safeActivityPage ===
                      totalActivityPages
                    }
                    style={{
                      minWidth: "90px",
                      height: "34px",
                      padding: "0 12px",
                      border:
                        "1px solid var(--color-border)",
                      borderRadius: "7px",
                      background:
                        safeActivityPage ===
                        totalActivityPages
                          ? "#f1f5f9"
                          : "#ffffff",
                      color:
                        safeActivityPage ===
                        totalActivityPages
                          ? "#94a3b8"
                          : "#334155",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor:
                        safeActivityPage ===
                        totalActivityPages
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              )}

            {activities.length > 0 && (
              <div className="control-activity-count">
                Showing{" "}
                <strong>
                  {activityStartIndex + 1}
                </strong>
                –
                <strong>
                  {activityEndIndex}
                </strong>{" "}
                of{" "}
                <strong>
                  {activities.length}
                </strong>{" "}
                database activities for{" "}
                <strong>
                  {DEVICE_ID}
                </strong>
              </div>
            )}

          </section>

          {/* =================================================
              DEVICE INFO
          ================================================= */}

          <div className="control-data-footer">

            <div>
              <Gauge size={15} />

              <span>
                Device: {DEVICE_ID}
              </span>
            </div>

            <div>
              <Wifi size={15} />

              <span>
                RSSI:{" "}
                {telemetry?.wifiRSSI !== null &&
                telemetry?.wifiRSSI !== undefined
                  ? `${telemetry.wifiRSSI} dBm`
                  : "--"}
              </span>
            </div>

            <div>
              <Zap size={15} />

              <span>
                Mode: {mode}
              </span>
            </div>

          </div>

        </>
      ) : null}

    </div>
  );
}

export default ControlCenter;