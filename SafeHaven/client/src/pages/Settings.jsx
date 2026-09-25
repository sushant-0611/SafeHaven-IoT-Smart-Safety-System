import { useCallback, useEffect, useState } from "react";

import {
  Bell,
  CheckCircle2,
  Gauge,
  MessageSquareText,
  Plus,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

import api from "../services/api";

import {
  connectSocket,
  disconnectSocket,
  socket,
  subscribeToDevice,
  unsubscribeFromDevice,
} from "../services/socket";

import "../styles/settings.css";

const DEVICE_ID = "SAFEHAVEN-001";

const DEFAULT_SETTINGS = {
  name: "SafeHaven System Settings",

  monitoring: {
    telemetryIntervalSeconds: 2,
    apiIntervalSeconds: 5,
    offlineTimeoutSeconds: 30,
  },

 sms: {
  enabled: true,
  phoneNumbers: [],
  cooldownSeconds: 60,

  warningMessage:
    "SAFEHAVEN WARNING\n\n" +
    "Sensor: {sensorTitle}\n" +
    "Current Reading: {sensor} = {value}{unit}\n" +
    "Warning Threshold: {threshold}{unit}\n" +
    "Reason: {reason}\n\n" +
    "Current Sensor Readings:\n" +
    "Temperature: {temperature}°C\n" +
    "Humidity: {humidity}%\n" +
    "Smoke: {smoke}%\n" +
    "Gas: {gas}%\n" +
    "Noise: {noise}\n" +
    "Fire: {fire}%\n\n" +
    "Please check the system.",

  dangerMessage:
    "SAFEHAVEN DANGER\n\n" +
    "Critical Safety Condition Detected!\n\n" +
    "Sensor: {sensorTitle}\n" +
    "Current Reading: {sensor} = {value}{unit}\n" +
    "Danger Threshold: {threshold}{unit}\n" +
    "Reason: {reason}\n\n" +
    "Current Sensor Readings:\n" +
    "Temperature: {temperature}°C\n" +
    "Humidity: {humidity}%\n" +
    "Smoke: {smoke}%\n" +
    "Gas: {gas}%\n" +
    "Noise: {noise}\n" +
    "Fire: {fire}%\n\n" +
    "Immediate attention is required. Please check the system.",
},

  automation: {
    enabled: true,
    manualOverride: true,
    firePump: true,
    gasExhaust: true,
    dangerBuzzer: true,
  },

  notifications: {
    browser: true,
    sms: true,
    dangerOnly: false,
  },

  thresholds: {
    temperature: {
      warning: 40,
      danger: 45,
      unit: "°C",
    },

    humidity: {
      warning: 60,
      danger: 80,
      unit: "%",
    },

    smoke: {
      warning: 40,
      danger: 70,
      unit: "%",
    },

    gas: {
      warning: 40,
      danger: 70,
      unit: "%",
    },

    noise: {
      warning: 50,
      danger: 80,
      unit: "Index",
    },

    fire: {
      warning: 50,
      danger: 70,
      unit: "%",
    },
  },
};

/* =========================================================
   THRESHOLD ROW
   ========================================================= */

function ThresholdRow({
  label,
  description,
  value,
  onChange,
  unit,
  max = 100,
}) {
  return (
    <div className="threshold-row">
      <div className="threshold-info">
        <strong>{label}</strong>
        <span>{description}</span>
      </div>

      <div className="threshold-fields">
        <label>
          <span>Warning</span>

          <div className="threshold-input">
            <input
              type="number"
              min="0"
              max={max}
              step="0.1"
              value={value?.warning ?? ""}
              onChange={(event) =>
                onChange("warning", event.target.value)
              }
            />

            <span>{unit}</span>
          </div>
        </label>

        <label>
          <span>Danger</span>

          <div className="threshold-input danger-input">
            <input
              type="number"
              min="0"
              max={max}
              step="0.1"
              value={value?.danger ?? ""}
              onChange={(event) =>
                onChange("danger", event.target.value)
              }
            />

            <span>{unit}</span>
          </div>
        </label>
      </div>
    </div>
  );
}

/* =========================================================
   TOGGLE
   ========================================================= */

function Toggle({
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className={`settings-toggle ${checked ? "enabled" : ""}`}
      onClick={() => onChange(!checked)}
      aria-label="Toggle setting"
      aria-pressed={checked}
      disabled={disabled}
    >
      <span />
    </button>
  );
}

/* =========================================================
   SETTINGS PAGE
   ========================================================= */

function Settings() {
  const [settings, setSettings] =
    useState(DEFAULT_SETTINGS);

  const [device, setDevice] = useState(null);

  const [loadingSettings, setLoadingSettings] =
    useState(true);

  const [loadingDevice, setLoadingDevice] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [socketConnected, setSocketConnected] =
    useState(socket.connected);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [validationError, setValidationError] =
    useState("");

  const [newPhoneNumber, setNewPhoneNumber] =
    useState("");

  /* =======================================================
     NORMALIZE SETTINGS
     ======================================================= */

  const normalizeSettings = useCallback((data) => {
    return {
      name:
        data?.name ||
        DEFAULT_SETTINGS.name,

      monitoring: {
        ...DEFAULT_SETTINGS.monitoring,
        ...(data?.monitoring || {}),
      },

      sms: {
        ...DEFAULT_SETTINGS.sms,
        ...(data?.sms || {}),

        phoneNumbers: Array.isArray(
          data?.sms?.phoneNumbers
        )
          ? data.sms.phoneNumbers
          : [],
      },

      automation: {
        ...DEFAULT_SETTINGS.automation,
        ...(data?.automation || {}),
      },

      notifications: {
        ...DEFAULT_SETTINGS.notifications,
        ...(data?.notifications || {}),
      },

      thresholds: {
        temperature: {
          ...DEFAULT_SETTINGS.thresholds.temperature,
          ...(data?.thresholds?.temperature || {}),
        },

        humidity: {
          ...DEFAULT_SETTINGS.thresholds.humidity,
          ...(data?.thresholds?.humidity || {}),
        },

        smoke: {
          ...DEFAULT_SETTINGS.thresholds.smoke,
          ...(data?.thresholds?.smoke || {}),
        },

        gas: {
          ...DEFAULT_SETTINGS.thresholds.gas,
          ...(data?.thresholds?.gas || {}),
        },

        noise: {
          ...DEFAULT_SETTINGS.thresholds.noise,
          ...(data?.thresholds?.noise || {}),
        },

        fire: {
          ...DEFAULT_SETTINGS.thresholds.fire,
          ...(data?.thresholds?.fire || {}),
        },
      },
    };
  }, []);

  /* =======================================================
     API ERROR
     ======================================================= */

  const getApiErrorMessage = (
    requestError,
    fallback
  ) => {
    return (
      requestError?.response?.data?.error ||
      requestError?.response?.data?.message ||
      requestError?.message ||
      fallback
    );
  };

  /* =======================================================
     LOAD SETTINGS
     ======================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        setLoadingSettings(true);
        setError("");

        const response =
          await api.get("/settings");

        if (!mounted) return;

        const data =
          response.data?.data ||
          response.data;

        setSettings(
          normalizeSettings(data)
        );
      } catch (requestError) {
        console.error(
          "Failed to load settings:",
          requestError
        );

        if (mounted) {
          setSettings(
            normalizeSettings(
              DEFAULT_SETTINGS
            )
          );

          setError(
            getApiErrorMessage(
              requestError,
              "Unable to load system settings."
            )
          );
        }
      } finally {
        if (mounted) {
          setLoadingSettings(false);
        }
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, [normalizeSettings]);

  /* =======================================================
     LOAD REAL DEVICE STATUS

     IMPORTANT:
     /devices/:deviceId/status is the source of truth
     for ESP32 connection status.

     Socket.IO connection is NOT treated as ESP32
     connection status.
     ======================================================= */

  const loadDeviceStatus = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoadingDevice(true);
        }

        const response =
          await api.get(
            `/devices/${DEVICE_ID}/status`
          );

        const raw =
          response.data?.data ||
          response.data?.device ||
          response.data;

        if (!raw) {
          setDevice(null);
          return;
        }

        setDevice((current) => ({
          ...(current || {}),
          ...raw,
        }));
      } catch (requestError) {
        console.error(
          "Failed to load device status:",
          requestError
        );

        /*
         * API failure does NOT automatically mean
         * the ESP32 is online.
         *
         * We keep previous device information and
         * allow the connection calculation below
         * to determine status from the available
         * backend information.
         */
      } finally {
        if (showLoader) {
          setLoadingDevice(false);
        }
      }
    },
    []
  );

  /* =======================================================
     INITIAL DEVICE STATUS
     ======================================================= */

  useEffect(() => {
    loadDeviceStatus(true);
  }, [loadDeviceStatus]);

  /* =======================================================
     REAL DEVICE STATUS POLLING

     Every 5 seconds.
     ======================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      loadDeviceStatus(false);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [loadDeviceStatus]);

  /* =======================================================
     SOCKET

     Socket is ONLY used for realtime updates.

     socketConnected is NOT used as ESP32 connection
     state.
     ======================================================= */

  useEffect(() => {
    const handleConnect = () => {
      setSocketConnected(true);

      subscribeToDevice(
        DEVICE_ID
      );

      /*
       * Immediately refresh the actual
       * ESP32 status.
       */
      loadDeviceStatus(false);
    };

    const handleDisconnect = () => {
      setSocketConnected(false);

      /*
       * Do NOT set ESP32 offline here.

       * Socket disconnect only means that the
       * browser/backend realtime connection
       * disconnected.
       *
       * Actual ESP32 connection is determined
       * by backend device status.
       */
    };

    const handleDeviceStatus = (payload) => {
      const incomingDevice =
        payload?.data ||
        payload?.device ||
        payload;

      if (!incomingDevice) return;

      const incomingDeviceId =
        incomingDevice?.deviceId ||
        incomingDevice?.id;

      if (
        incomingDeviceId &&
        String(incomingDeviceId).toUpperCase() !==
          DEVICE_ID
      ) {
        return;
      }

      setDevice((current) => ({
        ...(current || {}),
        ...incomingDevice,
      }));
    };

    const handleTelemetryUpdate = (
      payload
    ) => {
      const incoming =
        payload?.data ||
        payload?.telemetry ||
        payload;

      if (!incoming) return;

      /*
       * Telemetry received means that the ESP32
       * has recently communicated.
       */

      const telemetryTimestamp =
        incoming?.timestamp ||
        incoming?.createdAt ||
        incoming?.updatedAt;

      setDevice((current) => ({
        ...(current || {}),
        ...incoming,

        deviceId:
          incoming?.deviceId ||
          current?.deviceId ||
          DEVICE_ID,

        lastSeen:
          telemetryTimestamp ||
          current?.lastSeen ||
          current?.updatedAt,
      }));
    };

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "device:status",
      handleDeviceStatus
    );

    socket.on(
      "telemetry:update",
      handleTelemetryUpdate
    );

    connectSocket();

    if (socket.connected) {
      subscribeToDevice(
        DEVICE_ID
      );
    }

    return () => {
      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "device:status",
        handleDeviceStatus
      );

      socket.off(
        "telemetry:update",
        handleTelemetryUpdate
      );

      unsubscribeFromDevice(
        DEVICE_ID
      );

      disconnectSocket();
    };
  }, [loadDeviceStatus]);

  /* =======================================================
     UPDATE THRESHOLD
     ======================================================= */

  const updateThreshold = (
    sensor,
    type,
    value
  ) => {
    setSettings((current) => ({
      ...current,

      thresholds: {
        ...current.thresholds,

        [sensor]: {
          ...current.thresholds[sensor],
          [type]: value,
        },
      },
    }));

    setSaved(false);
    setValidationError("");
    setError("");
  };

  /* =======================================================
     UPDATE AUTOMATION
     ======================================================= */

  const updateAutomation = (
    setting,
    value
  ) => {
    setSettings((current) => ({
      ...current,

      automation: {
        ...current.automation,
        [setting]: value,
      },
    }));

    setSaved(false);
    setError("");
  };

  /* =======================================================
     UPDATE NOTIFICATIONS
     ======================================================= */

  const updateNotifications = (
    setting,
    value
  ) => {
    setSettings((current) => ({
      ...current,

      notifications: {
        ...current.notifications,
        [setting]: value,
      },
    }));

    setSaved(false);
    setError("");
  };

  /* =======================================================
     UPDATE SMS
     ======================================================= */

  const updateSms = (
    setting,
    value
  ) => {
    setSettings((current) => ({
      ...current,

      sms: {
        ...current.sms,
        [setting]: value,
      },
    }));

    setSaved(false);
    setError("");
    setValidationError("");
  };

  /* =======================================================
     ADD PHONE NUMBER
     ======================================================= */

  const addPhoneNumber = () => {
    const number =
      newPhoneNumber.trim();

    if (!number) {
      setValidationError(
        "Please enter a mobile number."
      );

      return;
    }

    const normalizedNumber =
      number.replace(/\s+/g, "");

    /*
     * Indian mobile number:
     *
     * 9876543210
     * +919876543210
     */

    const valid =
      /^(?:\+91)?[6-9]\d{9}$/.test(
        normalizedNumber
      );

    if (!valid) {
      setValidationError(
        "Enter a valid Indian mobile number. Example: 9876543210 or +919876543210."
      );

      return;
    }

    if (
      settings.sms.phoneNumbers.includes(
        normalizedNumber
      )
    ) {
      setValidationError(
        "This mobile number is already added."
      );

      return;
    }

    setSettings((current) => ({
      ...current,

      sms: {
        ...current.sms,

        phoneNumbers: [
          ...current.sms.phoneNumbers,
          normalizedNumber,
        ],
      },
    }));

    setNewPhoneNumber("");
    setValidationError("");
    setSaved(false);
  };

  /* =======================================================
     REMOVE PHONE NUMBER
     ======================================================= */

  const removePhoneNumber = (
    index
  ) => {
    setSettings((current) => ({
      ...current,

      sms: {
        ...current.sms,

        phoneNumbers:
          current.sms.phoneNumbers.filter(
            (_, itemIndex) =>
              itemIndex !== index
          ),
      },
    }));

    setSaved(false);
  };

  /* =======================================================
     PHONE ENTER KEY
     ======================================================= */

  const handlePhoneKeyDown = (
    event
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPhoneNumber();
    }
  };

  /* =======================================================
     VALIDATE SETTINGS
     ======================================================= */

  const validateSettings = () => {
    const sensors = [
      "temperature",
      "humidity",
      "smoke",
      "gas",
      "noise",
      "fire",
    ];

    for (const sensor of sensors) {
      const threshold =
        settings.thresholds?.[sensor];

      if (!threshold) {
        return `${sensor} threshold configuration is missing.`;
      }

      const warning =
        Number(threshold.warning);

      const danger =
        Number(threshold.danger);

      if (
        !Number.isFinite(warning) ||
        !Number.isFinite(danger)
      ) {
        return `${sensor} thresholds must contain valid numbers.`;
      }

      if (
        warning < 0 ||
        danger < 0
      ) {
        return `${sensor} thresholds cannot be negative.`;
      }

      if (
        warning >= danger
      ) {
        return `${sensor}: warning threshold must be lower than danger threshold.`;
      }

      if (
        sensor !== "temperature" &&
        (
          warning > 100 ||
          danger > 100
        )
      ) {
        return `${sensor}: threshold values cannot exceed 100.`;
      }

      if (
        sensor === "temperature" &&
        danger > 100
      ) {
        return "Temperature danger threshold cannot exceed 100°C.";
      }
    }

    /* =====================================================
       PHONE VALIDATION
       ===================================================== */

    for (
      const number of
      settings.sms.phoneNumbers
    ) {
      if (
        !/^(?:\+91)?[6-9]\d{9}$/.test(
          number
        )
      ) {
        return `Invalid SMS phone number: ${number}`;
      }
    }

    /* =====================================================
       SMS CONTENT
       ===================================================== */

    const warningMessage =
      String(
        settings.sms.warningMessage ||
          ""
      ).trim();

    const dangerMessage =
      String(
        settings.sms.dangerMessage ||
          ""
      ).trim();

    if (!warningMessage) {
      return "Warning SMS content cannot be empty.";
    }

    if (!dangerMessage) {
      return "Danger SMS content cannot be empty.";
    }

    if (
      warningMessage.length > 500
    ) {
      return "Warning SMS content cannot exceed 500 characters.";
    }

    if (
      dangerMessage.length > 500
    ) {
      return "Danger SMS content cannot exceed 500 characters.";
    }

    const cooldown =
      Number(
        settings.sms.cooldownSeconds
      );

    if (
      !Number.isFinite(cooldown) ||
      cooldown < 0
    ) {
      return "SMS cooldown must be zero or greater.";
    }

    return "";
  };

  /* =======================================================
     BUILD PAYLOAD
     ======================================================= */

  const buildPayload = () => {
    return {
      name:
        settings.name ||
        DEFAULT_SETTINGS.name,

      monitoring: {
        telemetryIntervalSeconds:
          Number(
            settings.monitoring
              ?.telemetryIntervalSeconds ??
              2
          ),

        apiIntervalSeconds:
          Number(
            settings.monitoring
              ?.apiIntervalSeconds ??
              5
          ),

        offlineTimeoutSeconds:
          Number(
            settings.monitoring
              ?.offlineTimeoutSeconds ??
              30
          ),
      },

      sms: {
        enabled: Boolean(
          settings.sms?.enabled
        ),

        phoneNumbers:
          Array.isArray(
            settings.sms?.phoneNumbers
          )
            ? settings.sms.phoneNumbers
            : [],

        cooldownSeconds:
          Number(
            settings.sms
              ?.cooldownSeconds ??
              60
          ),

        warningMessage:
          settings.sms
            ?.warningMessage ||
          DEFAULT_SETTINGS.sms
            .warningMessage,

        dangerMessage:
          settings.sms
            ?.dangerMessage ||
          DEFAULT_SETTINGS.sms
            .dangerMessage,
      },

      automation: {
        enabled: Boolean(
          settings.automation?.enabled
        ),

        manualOverride: Boolean(
          settings.automation
            ?.manualOverride
        ),

        firePump: Boolean(
          settings.automation
            ?.firePump
        ),

        gasExhaust: Boolean(
          settings.automation
            ?.gasExhaust
        ),

        dangerBuzzer: Boolean(
          settings.automation
            ?.dangerBuzzer
        ),
      },

      notifications: {
        browser: Boolean(
          settings.notifications
            ?.browser
        ),

        sms: Boolean(
          settings.notifications?.sms
        ),

        dangerOnly: Boolean(
          settings.notifications
            ?.dangerOnly
        ),
      },

      thresholds: {
        temperature: {
          warning: Number(
            settings.thresholds
              .temperature.warning
          ),

          danger: Number(
            settings.thresholds
              .temperature.danger
          ),

          unit: "°C",
        },

        humidity: {
          warning: Number(
            settings.thresholds
              .humidity.warning
          ),

          danger: Number(
            settings.thresholds
              .humidity.danger
          ),

          unit: "%",
        },

        smoke: {
          warning: Number(
            settings.thresholds
              .smoke.warning
          ),

          danger: Number(
            settings.thresholds
              .smoke.danger
          ),

          unit: "%",
        },

        gas: {
          warning: Number(
            settings.thresholds
              .gas.warning
          ),

          danger: Number(
            settings.thresholds
              .gas.danger
          ),

          unit: "%",
        },

        noise: {
          warning: Number(
            settings.thresholds
              .noise.warning
          ),

          danger: Number(
            settings.thresholds
              .noise.danger
          ),

          unit: "Index",
        },

        fire: {
          warning: Number(
            settings.thresholds
              .fire.warning
          ),

          danger: Number(
            settings.thresholds
              .fire.danger
          ),

          unit: "%",
        },
      },
    };
  };

  /* =======================================================
     SAVE SETTINGS
     ======================================================= */

  const saveSettings = async () => {
    const validation =
      validateSettings();

    if (validation) {
      setValidationError(
        validation
      );

      setSaved(false);

      return;
    }

    try {
      setSaving(true);
      setError("");
      setValidationError("");
      setSaved(false);

      const payload =
        buildPayload();

      const response =
        await api.put(
          "/settings",
          payload
        );

      const updatedSettings =
        response.data?.data ||
        response.data;

      if (!updatedSettings) {
        throw new Error(
          "Server did not return updated settings."
        );
      }

      setSettings(
        normalizeSettings(
          updatedSettings
        )
      );

      setSaved(true);

      window.setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (requestError) {
      console.error(
        "Failed to save settings:",
        requestError
      );

      setError(
        getApiErrorMessage(
          requestError,
          "Settings could not be saved."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     RESET SETTINGS
     ======================================================= */

  const resetSettings = async () => {
    const confirmed =
      window.confirm(
        "Reset all SafeHaven system settings to default values?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setValidationError("");
      setSaved(false);

      const response =
        await api.put(
          "/settings",
          DEFAULT_SETTINGS
        );

      const updatedSettings =
        response.data?.data ||
        response.data;

      setSettings(
        normalizeSettings(
          updatedSettings
        )
      );

      setNewPhoneNumber("");

      setSaved(true);

      window.setTimeout(() => {
        setSaved(false);
      }, 3000);
    } catch (requestError) {
      console.error(
        "Failed to reset settings:",
        requestError
      );

      setError(
        getApiErrorMessage(
          requestError,
          "Settings could not be reset."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* =======================================================
     REAL ESP32 CONNECTION STATUS
     ======================================================= */

  const latestStatus =
    String(
      device?.safetyStatus ||
        "UNKNOWN"
    ).toUpperCase();

  /*
   * Determine ESP32 connection state.

   * Priority:
   *
   * 1. Backend online flag
   * 2. Backend connection status
   * 3. Backend device status
   * 4. lastSeen timestamp
   *
   * Socket connection is intentionally NOT used.
   */

  const getDeviceConnectionState =
    () => {
      if (!device) {
        return {
          online: false,
          source: "NO_DEVICE_DATA",
        };
      }

      /* =================================================
         EXPLICIT BACKEND ONLINE FLAG
         ================================================= */

      if (
        typeof device.online ===
        "boolean"
      ) {
        return {
          online: device.online,
          source:
            "BACKEND_ONLINE_FLAG",
        };
      }

      if (
        typeof device.isOnline ===
        "boolean"
      ) {
        return {
          online: device.isOnline,
          source:
            "BACKEND_IS_ONLINE_FLAG",
        };
      }

      /* =================================================
         EXPLICIT CONNECTION STATUS
         ================================================= */

      const connectionStatus =
        String(
          device.connectionStatus ||
            ""
        ).toUpperCase();

      if (
        connectionStatus === "ONLINE" ||
        connectionStatus === "CONNECTED"
      ) {
        return {
          online: true,
          source:
            "BACKEND_CONNECTION_STATUS",
        };
      }

      if (
        connectionStatus === "OFFLINE" ||
        connectionStatus === "DISCONNECTED"
      ) {
        return {
          online: false,
          source:
            "BACKEND_CONNECTION_STATUS",
        };
      }

      /* =================================================
         DEVICE STATUS
         ================================================= */

      const deviceStatus =
        String(
          device.deviceStatus ||
            device.status ||
            ""
        ).toUpperCase();

      if (
        deviceStatus === "ONLINE" ||
        deviceStatus === "CONNECTED"
      ) {
        return {
          online: true,
          source:
            "BACKEND_DEVICE_STATUS",
        };
      }

      if (
        deviceStatus === "OFFLINE" ||
        deviceStatus === "DISCONNECTED"
      ) {
        return {
          online: false,
          source:
            "BACKEND_DEVICE_STATUS",
        };
      }

      /* =================================================
         LAST SEEN FALLBACK
         ================================================= */

      const lastSeen =
        device.lastSeen ||
        device.timestamp ||
        device.updatedAt ||
        device.createdAt;

      if (lastSeen) {
        const lastSeenTime =
          new Date(
            lastSeen
          ).getTime();

        if (
          Number.isFinite(
            lastSeenTime
          )
        ) {
          const ageSeconds =
            (Date.now() -
              lastSeenTime) /
            1000;

          const offlineTimeout =
            Number(
              settings.monitoring
                ?.offlineTimeoutSeconds ??
                30
            );

          return {
            online:
              ageSeconds <=
              offlineTimeout,

            source:
              "LAST_SEEN",

            ageSeconds,
          };
        }
      }

      /*
       * If backend cannot confirm
       * device connection, show Offline.
       */

      return {
        online: false,
        source: "UNKNOWN",
      };
    };

  const connectionState =
    getDeviceConnectionState();

  const isDeviceOnline =
    connectionState.online;

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="settings-page">

      {/* =================================================
          HEADER
          ================================================= */}

      <header className="settings-page-header">
        <div>
          <div className="settings-title-row">
            <SettingsIcon size={23} />

            <h1>
              System Settings
            </h1>
          </div>

          <p>
            Configure sensor thresholds,
            automation, SMS notifications,
            and device preferences.
          </p>
        </div>
      </header>

      {/* =================================================
          LOADING
          ================================================= */}

      {loadingSettings && (
        <div className="settings-save-message">
          <Gauge size={18} />

          <div>
            <strong>
              Loading Settings...
            </strong>

            <span>
              Fetching configuration
              from the SafeHaven backend.
            </span>
          </div>
        </div>
      )}

      {/* =================================================
          SUCCESS
          ================================================= */}

      {saved && (
        <div className="settings-save-message">
          <CheckCircle2 size={18} />

          <div>
            <strong>
              Settings saved
            </strong>

            <span>
              SafeHaven configuration
              has been saved to MongoDB.
            </span>
          </div>
        </div>
      )}

      {/* =================================================
          VALIDATION
          ================================================= */}

      {validationError && (
        <div className="settings-error-message">
          <XCircle size={18} />

          <div>
            <strong>
              Invalid configuration
            </strong>

            <span>
              {validationError}
            </span>
          </div>
        </div>
      )}

      {/* =================================================
          ERROR
          ================================================= */}

      {error && (
        <div className="settings-error-message">
          <XCircle size={18} />

          <div>
            <strong>
              Settings error
            </strong>

            <span>
              {error}
            </span>
          </div>
        </div>
      )}

      {/* =================================================
          SENSOR THRESHOLDS
          FULL WIDTH
          ================================================= */}

      <section className="settings-section">

        <div className="settings-section-header">
          <div className="section-icon blue">
            <Gauge size={20} />
          </div>

          <div>
            <h2>
              Sensor Thresholds
            </h2>

            <p>
              Define warning and danger
              levels for each safety sensor.
            </p>
          </div>
        </div>

        <div className="threshold-header">
          <span>
            Sensor
          </span>

          <div>
            <span>
              Warning Threshold
            </span>

            <span>
              Danger Threshold
            </span>
          </div>
        </div>

        <div className="threshold-list">

          <ThresholdRow
            label="Temperature"
            description="DHT11 environmental temperature"
            value={
              settings.thresholds.temperature
            }
            unit="°C"
            max={100}
            onChange={(type, value) =>
              updateThreshold(
                "temperature",
                type,
                value
              )
            }
          />

          <ThresholdRow
            label="Humidity"
            description="DHT11 relative humidity"
            value={
              settings.thresholds.humidity
            }
            unit="%"
            max={100}
            onChange={(type, value) =>
              updateThreshold(
                "humidity",
                type,
                value
              )
            }
          />

          <ThresholdRow
            label="Smoke"
            description="MQ-2 normalized smoke level"
            value={
              settings.thresholds.smoke
            }
            unit="%"
            max={100}
            onChange={(type, value) =>
              updateThreshold(
                "smoke",
                type,
                value
              )
            }
          />

          <ThresholdRow
            label="Gas"
            description="MQ-6 normalized gas level"
            value={
              settings.thresholds.gas
            }
            unit="%"
            max={100}
            onChange={(type, value) =>
              updateThreshold(
                "gas",
                type,
                value
              )
            }
          />

          <ThresholdRow
            label="Noise"
            description="Sound sensor noise index"
            value={
              settings.thresholds.noise
            }
            unit="Index"
            max={100}
            onChange={(type, value) =>
              updateThreshold(
                "noise",
                type,
                value
              )
            }
          />

          <ThresholdRow
            label="Fire"
            description="Flame sensor detection index"
            value={
              settings.thresholds.fire
            }
            unit="%"
            max={100}
            onChange={(type, value) =>
              updateThreshold(
                "fire",
                type,
                value
              )
            }
          />

        </div>

        <div className="threshold-note">
          <ShieldCheck size={16} />

          <span>
            Warning values must remain
            below danger values.
          </span>
        </div>

      </section>

      {/* =================================================
          AUTOMATION
          FULL WIDTH
          ================================================= */}

      <section className="settings-section">

        <div className="settings-section-header">
          <div className="section-icon green">
            <Zap size={20} />
          </div>

          <div>
            <h2>
              Automation
            </h2>

            <p>
              Configure automatic safety
              responses.
            </p>
          </div>
        </div>

        {/* AUTOMATIC SAFETY MODE */}

        <div className="settings-option">
          <div>
            <strong>
              Automatic Safety Mode
            </strong>

            <span>
              Allow SafeHaven to control
              connected devices automatically.
            </span>
          </div>

          <Toggle
            checked={
              settings.automation.enabled
            }
            onChange={(value) =>
              updateAutomation(
                "enabled",
                value
              )
            }
            disabled={saving}
          />
        </div>

        {/* FIRE → WATER PUMP */}

        <div className="settings-option">
          <div>
            <strong>
              Fire → Water Pump
            </strong>

            <span>
              Activate the water pump when
              fire danger is detected.
            </span>
          </div>

          <Toggle
            checked={
              settings.automation.firePump
            }
            onChange={(value) =>
              updateAutomation(
                "firePump",
                value
              )
            }
            disabled={saving}
          />
        </div>

        {/* GAS/SMOKE → EXHAUST FAN */}

        <div className="settings-option">
          <div>
            <strong>
              Gas/Smoke → Exhaust Fan
            </strong>

            <span>
              Activate the exhaust fan during
              gas or smoke danger.
            </span>
          </div>

          <Toggle
            checked={
              settings.automation.gasExhaust
            }
            onChange={(value) =>
              updateAutomation(
                "gasExhaust",
                value
              )
            }
            disabled={saving}
          />
        </div>

        {/* DANGER → BUZZER */}

        <div className="settings-option">
          <div>
            <strong>
              Danger → Safety Buzzer
            </strong>

            <span>
              Activate the buzzer whenever
              overall status becomes danger.
            </span>
          </div>

          <Toggle
            checked={
              settings.automation.dangerBuzzer
            }
            onChange={(value) =>
              updateAutomation(
                "dangerBuzzer",
                value
              )
            }
            disabled={saving}
          />
        </div>

        {/* SAFETY OVERRIDE */}

        <div className="settings-option">
          <div>
            <strong>
              Safety Override
            </strong>

            <span>
              Allow automatic safety actions
              to override manual controls.
            </span>
          </div>

          <Toggle
            checked={
              settings.automation.manualOverride
            }
            onChange={(value) =>
              updateAutomation(
                "manualOverride",
                value
              )
            }
            disabled={saving}
          />
        </div>

      </section>

      {/* =================================================
          NOTIFICATIONS
          FULL WIDTH
          ================================================= */}

      <section className="settings-section">

        <div className="settings-section-header">
          <div className="section-icon orange">
            <Bell size={20} />
          </div>

          <div>
            <h2>
              Notifications
            </h2>

            <p>
              Configure browser and SMS
              safety notifications.
            </p>
          </div>
        </div>

        {/* SMS NOTIFICATION */}

        <div className="settings-option">
          <div>
            <strong>
              SMS Notifications
            </strong>

            <span>
              Send warning and danger
              alerts through GSM/SMS.
            </span>
          </div>

          <Toggle
            checked={
              settings.notifications.sms
            }
            onChange={(value) =>
              updateNotifications(
                "sms",
                value
              )
            }
            disabled={saving}
          />
        </div>

        {/* SMS SERVICE */}

        <div className="settings-option">
          <div>
            <strong>
              SMS Service Enabled
            </strong>

            <span>
              Enable the SafeHaven SMS
              service for configured recipients.
            </span>
          </div>

          <Toggle
            checked={
              settings.sms.enabled
            }
            onChange={(value) =>
              updateSms(
                "enabled",
                value
              )
            }
            disabled={saving}
          />
        </div>

        {/* SMS CONFIGURATION */}

        <div className="sms-settings-box">

          <div className="sms-settings-title">
            <MessageSquareText size={17} />

            <div>
              <strong>
                SMS Configuration
              </strong>

              <span>
                Configure recipients,
                cooldown and custom
                alert messages.
              </span>
            </div>
          </div>

          {/* MOBILE NUMBERS */}

          <div className="sms-field">

            <label>
              Mobile Numbers
            </label>

            <span className="sms-field-help">
              Add one or more numbers
              that should receive alerts.
            </span>

            <div className="sms-add-number">

              <input
                type="tel"
                value={
                  newPhoneNumber
                }
                onChange={(event) =>
                  setNewPhoneNumber(
                    event.target.value
                  )
                }
                onKeyDown={
                  handlePhoneKeyDown
                }
                placeholder="9876543210"
                maxLength={15}
                disabled={saving}
              />

              <button
                type="button"
                onClick={
                  addPhoneNumber
                }
                disabled={saving}
              >
                <Plus size={16} />

                Add Number
              </button>

            </div>

            <div className="sms-number-list">

              {settings.sms.phoneNumbers
                .length === 0 ? (

                <div className="sms-empty">
                  No SMS numbers added.
                </div>

              ) : (

                settings.sms.phoneNumbers.map(
                  (
                    number,
                    index
                  ) => (
                    <div
                      className="sms-number-item"
                      key={`${number}-${index}`}
                    >
                      <span>
                        {number}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removePhoneNumber(
                            index
                          )
                        }
                        disabled={
                          saving
                        }
                        aria-label={`Remove ${number}`}
                      >
                        <Trash2
                          size={15}
                        />
                      </button>
                    </div>
                  )
                )

              )}

            </div>

          </div>

          {/* COOLDOWN */}

          <div className="sms-field">

            <label>
              SMS Cooldown
            </label>

            <span className="sms-field-help">
              Minimum time before another
              SMS alert is sent.
            </span>

            <div className="sms-cooldown-input">

              <input
                type="number"
                min="0"
                value={
                  settings.sms
                    .cooldownSeconds
                }
                onChange={(event) =>
                  updateSms(
                    "cooldownSeconds",
                    event.target.value
                  )
                }
                disabled={saving}
              />

              <span>
                seconds
              </span>

            </div>

          </div>

          {/* WARNING MESSAGE */}

          <div className="sms-field">

            <label>
              Warning SMS Content
            </label>

            <span className="sms-field-help">
              Message sent when a sensor
              crosses its warning threshold.
            </span>

            <textarea
              value={
                settings.sms
                  .warningMessage
              }
              onChange={(event) =>
                updateSms(
                  "warningMessage",
                  event.target.value
                )
              }
              maxLength={500}
              rows={4}
              placeholder="Enter warning SMS content..."
              disabled={saving}
            />

            <div className="sms-character-count">
              {
                settings.sms
                  .warningMessage
                  .length
              }{" "}
              / 500
            </div>

          </div>

          {/* DANGER MESSAGE */}

          <div className="sms-field">

            <label>
              Danger SMS Content
            </label>

            <span className="sms-field-help">
              Message sent when a sensor
              crosses its danger threshold.
            </span>

            <textarea
              value={
                settings.sms
                  .dangerMessage
              }
              onChange={(event) =>
                updateSms(
                  "dangerMessage",
                  event.target.value
                )
              }
              maxLength={500}
              rows={4}
              placeholder="Enter danger SMS content..."
              disabled={saving}
            />

            <div className="sms-character-count">
              {
                settings.sms
                  .dangerMessage
                  .length
              }{" "}
              / 500
            </div>

          </div>

          {/* PLACEHOLDER HELP */}

          <div className="sms-placeholder-help">

            <MessageSquareText
              size={16}
            />

            <div>

              <strong>
                Available message placeholders
              </strong>

              <span>
                You can use{" "}
                <code>
                  {"{sensor}"}
                </code>{" "}
                <code>
                  {"{value}"}
                </code>{" "}
                <code>
                  {"{unit}"}
                </code>{" "}
                <code>
                  {"{status}"}
                </code>{" "}
                <code>
                  {"{deviceId}"}
                </code>
              </span>

            </div>

          </div>

        </div>

        {/* BROWSER NOTIFICATIONS */}

        <div className="settings-option">

          <div>
            <strong>
              Browser Notifications
            </strong>

            <span>
              Display notifications in the
              SafeHaven web dashboard.
            </span>
          </div>

          <Toggle
            checked={
              settings.notifications.browser
            }
            onChange={(value) =>
              updateNotifications(
                "browser",
                value
              )
            }
            disabled={saving}
          />

        </div>

        {/* DANGER ONLY */}

        <div className="settings-option">

          <div>
            <strong>
              Danger Alerts Only
            </strong>

            <span>
              Suppress warning notifications
              and notify only for danger events.
            </span>
          </div>

          <Toggle
            checked={
              settings.notifications.dangerOnly
            }
            onChange={(value) =>
              updateNotifications(
                "dangerOnly",
                value
              )
            }
            disabled={saving}
          />

        </div>

        {/* INFO */}

        <div className="notification-info">

          <Bell size={17} />

          <span>
            SMS messages are sent to all
            configured numbers through the
            SafeHaven GSM integration.
          </span>

        </div>

      </section>

      {/* =================================================
          DEVICE CONFIGURATION
          FULL WIDTH
          ================================================= */}

      <section className="settings-section device-settings">

        <div className="settings-section-header">

          <div className="section-icon purple">
            <SettingsIcon size={20} />
          </div>

          <div>
            <h2>
              Device Configuration
            </h2>

            <p>
              Current information received
              from the SafeHaven device.
            </p>
          </div>

        </div>

        <div className="device-config-grid">

          {/* DEVICE ID */}

          <div className="device-config-item">

            <span>
              Device ID
            </span>

            <strong>
              {DEVICE_ID}
            </strong>

          </div>

          {/* DEVICE NAME */}

          <div className="device-config-item">

            <span>
              Device Name
            </span>

            <strong>
              {device?.name ||
                device?.deviceName ||
                "SafeHaven Primary Unit"}
            </strong>

          </div>

          {/* SAFETY STATUS */}

          <div className="device-config-item">

            <span>
              Safety Status
            </span>

            <strong
              className={`device-status-text ${latestStatus.toLowerCase()}`}
            >
              {latestStatus}
            </strong>

          </div>

          {/* REAL CONNECTION */}

          <div className="device-config-item">

            <span>
              Connection
            </span>

            <strong
              className={`online-text ${
                isDeviceOnline
                  ? "online"
                  : "offline"
              }`}
            >
              <span />

              {loadingDevice
                ? "Checking..."
                : isDeviceOnline
                ? "Online"
                : "Offline"}
            </strong>

            {!loadingDevice &&
              !isDeviceOnline && (
                <small className="device-connection-help">
                  ESP32 has not communicated
                  within the configured
                  offline timeout.
                </small>
              )}

            {!loadingDevice &&
              isDeviceOnline && (
                <small className="device-connection-help">
                  ESP32 communication is
                  active.
                </small>
              )}

          </div>

          {/* LAST SEEN */}

          <div className="device-config-item">

            <span>
              Last Seen
            </span>

            <strong>
              {device?.lastSeen
                ? new Date(
                    device.lastSeen
                  ).toLocaleString()
                : device?.timestamp
                ? new Date(
                    device.timestamp
                  ).toLocaleString()
                : "Not available"}
            </strong>

          </div>

          {/* OFFLINE TIMEOUT */}

          <div className="device-config-item">

            <span>
              Offline Timeout
            </span>

            <strong>
              {
                settings.monitoring
                  .offlineTimeoutSeconds
              }{" "}
              seconds
            </strong>

          </div>

        </div>

      </section>

      {/* =================================================
          ACTIONS
          ================================================= */}

      <div className="settings-actions">

        <button
          type="button"
          className="reset-settings-btn"
          onClick={
            resetSettings
          }
          disabled={saving}
        >
          <RotateCcw size={17} />

          {saving
            ? "Processing..."
            : "Reset Defaults"}
        </button>

        <button
          type="button"
          className="save-settings-btn"
          onClick={
            saveSettings
          }
          disabled={saving}
        >
          <Save size={17} />

          {saving
            ? "Saving..."
            : "Save Settings"}
        </button>

      </div>

      {/* =================================================
          STORAGE
          ================================================= */}

      <div className="settings-storage-note">

        <ShieldCheck size={16} />

        <span>
          All SafeHaven settings, SMS
          recipients and custom SMS content
          are stored in the backend database.
        </span>

      </div>

    </div>
  );
}

export default Settings;