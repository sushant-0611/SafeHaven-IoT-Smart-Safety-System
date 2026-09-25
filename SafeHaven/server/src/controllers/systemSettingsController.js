const SystemSettings = require("../models/SystemSettings");

/* =========================================================
   CONSTANTS
   ========================================================= */

const SENSOR_KEYS = [
  "temperature",
  "humidity",
  "smoke",
  "gas",
  "noise",
  "fire",
];

/* =========================================================
   DEFAULT SMS MESSAGES
   ========================================================= */

const DEFAULT_SMS_MESSAGES = {
  warning:
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

  danger:
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
};

/* =========================================================
   LEGACY SMS MESSAGES
   These were previously stored in MongoDB.
   If found, they are automatically replaced.
   ========================================================= */

const LEGACY_SMS_MESSAGES = {
  warning:
    "SafeHaven WARNING: A safety parameter has crossed the warning threshold. Please check the SafeHaven dashboard.",

  danger:
    "SafeHaven DANGER: A critical safety condition has been detected. Immediate attention is required.",
};

/* =========================================================
   DEFAULT SETTINGS
   ========================================================= */

const DEFAULT_SETTINGS = {
  name: "SafeHaven System Settings",

  monitoring: {
    telemetryIntervalSeconds: 2,
    apiIntervalSeconds: 5,
    offlineTimeoutSeconds: 30,
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

  sms: {
    enabled: true,
    phoneNumbers: [],
    cooldownSeconds: 60,

    warningMessage: DEFAULT_SMS_MESSAGES.warning,

    dangerMessage: DEFAULT_SMS_MESSAGES.danger,
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
};

/* =========================================================
   HELPERS
   ========================================================= */

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/* =========================================================
   SMS DEFAULT / LEGACY MIGRATION
   ========================================================= */

function isLegacyWarningMessage(message) {
  if (typeof message !== "string") {
    return true;
  }

  const normalized = message.trim();

  if (!normalized) {
    return true;
  }

  return normalized === LEGACY_SMS_MESSAGES.warning;
}

function isLegacyDangerMessage(message) {
  if (typeof message !== "string") {
    return true;
  }

  const normalized = message.trim();

  if (!normalized) {
    return true;
  }

  return normalized === LEGACY_SMS_MESSAGES.danger;
}

function normalizeSMSMessages(settings) {
  if (!settings.sms) {
    settings.sms = {};
  }

  /*
   * If old/default legacy content exists in DB,
   * automatically replace it with the new message.
   */

  if (
    isLegacyWarningMessage(
      settings.sms.warningMessage
    )
  ) {
    settings.sms.warningMessage =
      DEFAULT_SMS_MESSAGES.warning;
  }

  if (
    isLegacyDangerMessage(
      settings.sms.dangerMessage
    )
  ) {
    settings.sms.dangerMessage =
      DEFAULT_SMS_MESSAGES.danger;
  }

  if (
    !Array.isArray(settings.sms.phoneNumbers)
  ) {
    settings.sms.phoneNumbers = [];
  }

  if (
    settings.sms.enabled === undefined
  ) {
    settings.sms.enabled = true;
  }

  if (
    !Number.isFinite(
      Number(settings.sms.cooldownSeconds)
    )
  ) {
    settings.sms.cooldownSeconds = 60;
  }

  return settings;
}

/* =========================================================
   PHONE NUMBER VALIDATION
   ========================================================= */

function normalizePhoneNumbers(phoneNumbers) {
  if (!Array.isArray(phoneNumbers)) {
    return [];
  }

  const normalized = [];

  for (const value of phoneNumbers) {
    if (typeof value !== "string") {
      continue;
    }

    const number = value.trim();

    if (!number) {
      continue;
    }

    /*
     * Supports:
     * 9876543210
     * +919876543210
     * 919876543210
     */

    const valid = /^\+?[0-9]{10,15}$/.test(
      number
    );

    if (!valid) {
      throw new Error(
        `Invalid phone number: ${number}`
      );
    }

    if (!normalized.includes(number)) {
      normalized.push(number);
    }
  }

  return normalized;
}

/* =========================================================
   THRESHOLD VALIDATION
   ========================================================= */

function validateThreshold(
  sensor,
  threshold
) {
  if (!isObject(threshold)) {
    throw new Error(
      `${sensor} threshold configuration is missing.`
    );
  }

  const warning = Number(
    threshold.warning
  );

  const danger = Number(
    threshold.danger
  );

  if (
    !Number.isFinite(warning) ||
    !Number.isFinite(danger)
  ) {
    throw new Error(
      `${sensor} thresholds must contain valid numbers.`
    );
  }

  if (warning < 0 || danger < 0) {
    throw new Error(
      `${sensor} thresholds cannot be negative.`
    );
  }

  if (warning >= danger) {
    throw new Error(
      `${sensor}: warning threshold must be lower than danger threshold.`
    );
  }

  if (
    sensor !== "temperature" &&
    (warning > 100 || danger > 100)
  ) {
    throw new Error(
      `${sensor}: threshold values cannot exceed 100.`
    );
  }

  if (
    sensor === "temperature" &&
    danger > 100
  ) {
    throw new Error(
      "Temperature danger threshold cannot exceed 100°C."
    );
  }
}

/* =========================================================
   GET /api/settings
   ========================================================= */

const getSystemSettings = async (
  req,
  res
) => {
  try {
    let settings =
      await SystemSettings.findOne()
        .populate(
          "updatedBy",
          "name email role"
        )
        .lean();

    /* -----------------------------------------------------
       CREATE DEFAULT DOCUMENT IF NOT EXISTS
       ----------------------------------------------------- */

    if (!settings) {
      const created =
        await SystemSettings.create(
          cloneDefaults()
        );

      settings =
        await SystemSettings.findById(
          created._id
        )
          .populate(
            "updatedBy",
            "name email role"
          )
          .lean();
    }

    /* -----------------------------------------------------
       MIGRATE OLD SMS CONTENT
       ----------------------------------------------------- */

    const smsNeedsMigration =
      isLegacyWarningMessage(
        settings?.sms?.warningMessage
      ) ||
      isLegacyDangerMessage(
        settings?.sms?.dangerMessage
      );

    if (smsNeedsMigration) {
      const existing =
        await SystemSettings.findById(
          settings._id
        );

      if (existing) {
        normalizeSMSMessages(existing);

        await existing.save();

        settings =
          await SystemSettings.findById(
            existing._id
          )
            .populate(
              "updatedBy",
              "name email role"
            )
            .lean();
      }
    }

    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error(
      "getSystemSettings error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Failed to load system settings.",
    });
  }
};

/* =========================================================
   PUT /api/settings
   ========================================================= */

const updateSystemSettings = async (
  req,
  res
) => {
  try {
    const body = req.body || {};

    /* =====================================================
       FIND SETTINGS
       ===================================================== */

    let settings =
      await SystemSettings.findOne();

    if (!settings) {
      settings =
        new SystemSettings(
          cloneDefaults()
        );
    }

    /* =====================================================
       NAME
       ===================================================== */

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Settings name must be a string.",
        });
      }

      settings.name =
        body.name.trim() ||
        "SafeHaven System Settings";
    }

    /* =====================================================
       MONITORING
       ===================================================== */

    if (isObject(body.monitoring)) {
      const monitoring =
        body.monitoring;

      const telemetry =
        Number(
          monitoring.telemetryIntervalSeconds
        );

      const apiInterval =
        Number(
          monitoring.apiIntervalSeconds
        );

      const offlineTimeout =
        Number(
          monitoring.offlineTimeoutSeconds
        );

      if (
        !Number.isFinite(telemetry) ||
        telemetry < 1
      ) {
        throw new Error(
          "Telemetry interval must be at least 1 second."
        );
      }

      if (
        !Number.isFinite(apiInterval) ||
        apiInterval < 1
      ) {
        throw new Error(
          "API interval must be at least 1 second."
        );
      }

      if (
        !Number.isFinite(
          offlineTimeout
        ) ||
        offlineTimeout < 5
      ) {
        throw new Error(
          "Offline timeout must be at least 5 seconds."
        );
      }

      settings.monitoring = {
        telemetryIntervalSeconds:
          telemetry,

        apiIntervalSeconds:
          apiInterval,

        offlineTimeoutSeconds:
          offlineTimeout,
      };
    }

    /* =====================================================
       THRESHOLDS
       ===================================================== */

    if (isObject(body.thresholds)) {
      for (const sensor of SENSOR_KEYS) {
        if (
          body.thresholds[sensor] !==
          undefined
        ) {
          validateThreshold(
            sensor,
            body.thresholds[sensor]
          );

          settings.thresholds[sensor] = {
            warning: Number(
              body.thresholds[sensor]
                .warning
            ),

            danger: Number(
              body.thresholds[sensor]
                .danger
            ),

            unit:
              body.thresholds[sensor]
                .unit ||
              DEFAULT_SETTINGS
                .thresholds[sensor]
                .unit,
          };
        }
      }
    }

    /* =====================================================
       SMS
       ===================================================== */

    if (isObject(body.sms)) {
      const sms = body.sms;

      if (
        sms.enabled !== undefined
      ) {
        settings.sms.enabled =
          Boolean(sms.enabled);
      }

      if (
        sms.phoneNumbers !==
        undefined
      ) {
        settings.sms.phoneNumbers =
          normalizePhoneNumbers(
            sms.phoneNumbers
          );
      }

      if (
        sms.cooldownSeconds !==
        undefined
      ) {
        const cooldown =
          Number(
            sms.cooldownSeconds
          );

        if (
          !Number.isFinite(
            cooldown
          ) ||
          cooldown < 0
        ) {
          throw new Error(
            "SMS cooldown cannot be negative."
          );
        }

        settings.sms.cooldownSeconds =
          cooldown;
      }

      /* ---------------------------------------------------
         WARNING MESSAGE
         --------------------------------------------------- */

      if (
        sms.warningMessage !==
        undefined
      ) {
        if (
          typeof sms.warningMessage !==
          "string"
        ) {
          throw new Error(
            "Warning SMS message must be a string."
          );
        }

        const warningMessage =
          sms.warningMessage.trim();

        settings.sms.warningMessage =
          warningMessage ||
          DEFAULT_SMS_MESSAGES.warning;
      }

      /* ---------------------------------------------------
         DANGER MESSAGE
         --------------------------------------------------- */

      if (
        sms.dangerMessage !==
        undefined
      ) {
        if (
          typeof sms.dangerMessage !==
          "string"
        ) {
          throw new Error(
            "Danger SMS message must be a string."
          );
        }

        const dangerMessage =
          sms.dangerMessage.trim();

        settings.sms.dangerMessage =
          dangerMessage ||
          DEFAULT_SMS_MESSAGES.danger;
      }

      /* ---------------------------------------------------
         PROTECT AGAINST OLD LEGACY MESSAGE
         --------------------------------------------------- */

      normalizeSMSMessages(settings);

      /* ---------------------------------------------------
         MESSAGE LENGTH
         --------------------------------------------------- */

      if (
        settings.sms.warningMessage
          .length > 500
      ) {
        throw new Error(
          "Warning SMS message cannot exceed 500 characters."
        );
      }

      if (
        settings.sms.dangerMessage
          .length > 500
      ) {
        throw new Error(
          "Danger SMS message cannot exceed 500 characters."
        );
      }
    } else {
      /*
       * Even when frontend doesn't send sms object,
       * migrate old database values.
       */

      normalizeSMSMessages(settings);
    }

    /* =====================================================
       AUTOMATION
       ===================================================== */

    if (
      isObject(body.automation)
    ) {
      settings.automation = {
        enabled: Boolean(
          body.automation.enabled ??
            settings.automation.enabled
        ),

        manualOverride: Boolean(
          body.automation
            .manualOverride ??
            settings.automation
              .manualOverride
        ),

        firePump: Boolean(
          body.automation.firePump ??
            settings.automation
              .firePump
        ),

        gasExhaust: Boolean(
          body.automation
            .gasExhaust ??
            settings.automation
              .gasExhaust
        ),

        dangerBuzzer: Boolean(
          body.automation
            .dangerBuzzer ??
            settings.automation
              .dangerBuzzer
        ),
      };
    }

    /* =====================================================
       NOTIFICATIONS
       ===================================================== */

    if (
      isObject(body.notifications)
    ) {
      settings.notifications = {
        browser: Boolean(
          body.notifications.browser ??
            settings.notifications
              .browser
        ),

        sms: Boolean(
          body.notifications.sms ??
            settings.notifications.sms
        ),

        dangerOnly: Boolean(
          body.notifications
            .dangerOnly ??
            settings.notifications
              .dangerOnly
        ),
      };
    }

    /* =====================================================
       UPDATED BY
       ===================================================== */

    if (req.user?._id) {
      settings.updatedBy =
        req.user._id;
    }

    /* =====================================================
       SAVE
       ===================================================== */

    await settings.save();

    /* =====================================================
       RETURN UPDATED SETTINGS
       ===================================================== */

    const updated =
      await SystemSettings.findById(
        settings._id
      )
        .populate(
          "updatedBy",
          "name email role"
        )
        .lean();

    return res.json({
      success: true,

      message:
        "System settings updated successfully.",

      data: updated,
    });
  } catch (error) {
    console.error(
      "updateSystemSettings error:",
      error
    );

    return res.status(400).json({
      success: false,
      error:
        error.message ||
        "Failed to update system settings.",
    });
  }
};

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  getSystemSettings,
  updateSystemSettings,
};