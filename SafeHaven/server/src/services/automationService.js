const AutomationRule = require("../models/AutomationRule");
const Alert = require("../models/Alert");
const Command = require("../models/Command");
const SystemSettings = require("../models/SystemSettings");

const {
  shouldSendSMS,
  createSMSLogs,
} = require("./smsService");

const {
  emitAlertUpdate,
  emitCommandUpdate,
  emitDashboardRefresh,
} = require("./socketService");

/* =====================================================
   COMMAND PRIORITY
   ===================================================== */

const COMMAND_PRIORITY = {
  WARNING: "NORMAL",
  DANGER: "HIGH",
  CRITICAL: "CRITICAL",
};

/* =====================================================
   SENSOR CONFIGURATION
   ===================================================== */

const SENSOR_CONFIG = {
  temperature: {
    title: "High Temperature",
    unit: "°C",

    message: (value, threshold) =>
      `Temperature is ${value}°C. Threshold is ${threshold}°C.`,
  },

  humidity: {
    title: "High Humidity",
    unit: "%",

    message: (value, threshold) =>
      `Humidity is ${value}%. Threshold is ${threshold}%.`,
  },

  smoke: {
    title: "Smoke Detected",
    unit: "%",

    message: (value, threshold) =>
      `Smoke level is ${value}%. Threshold is ${threshold}%.`,
  },

  gas: {
    title: "Gas Leakage Detected",
    unit: "%",

    message: (value, threshold) =>
      `Gas level is ${value}%. Threshold is ${threshold}%.`,
  },

  noise: {
    title: "High Noise Level",
    unit: "Index",

    message: (value, threshold) =>
      `Noise index is ${value}. Threshold is ${threshold}.`,
  },

  fire: {
    title: "Fire Detected",
    unit: "%",

    message: (value, threshold) =>
      `Flame intensity is ${value}%. Threshold is ${threshold}%.`,
  },
};

/* =====================================================
   DEFAULT SMS MESSAGES
   ===================================================== */

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

/* =====================================================
   LEGACY SMS MESSAGES
   ===================================================== */

const LEGACY_SMS_MESSAGES = {
  warning:
    "SafeHaven WARNING: A safety parameter has crossed the warning threshold. Please check the SafeHaven dashboard.",

  danger:
    "SafeHaven DANGER: A critical safety condition has been detected. Immediate attention is required.",
};

/* =====================================================
   NORMALIZE DEVICE ID
   ===================================================== */

function normalizeDeviceId(deviceId) {
  return String(deviceId || "")
    .trim()
    .toUpperCase();
}

/* =====================================================
   COMPARE VALUE
   ===================================================== */

function compareValue(
  value,
  operator,
  threshold
) {
  switch (operator) {
    case ">":
      return value > threshold;

    case ">=":
      return value >= threshold;

    case "<":
      return value < threshold;

    case "<=":
      return value <= threshold;

    case "==":
      return value === threshold;

    default:
      return false;
  }
}

/* =====================================================
   GET SENSOR TITLE
   ===================================================== */

function getSensorTitle(sensor) {
  return (
    SENSOR_CONFIG[sensor]?.title ||
    "Safety Alert"
  );
}

/* =====================================================
   GET SENSOR MESSAGE
   ===================================================== */

function getSensorMessage(
  sensor,
  value,
  threshold
) {
  if (SENSOR_CONFIG[sensor]) {
    return SENSOR_CONFIG[sensor].message(
      value,
      threshold
    );
  }

  return `Sensor value ${value} crossed threshold ${threshold}.`;
}

/* =====================================================
   GET SENSOR UNIT
   ===================================================== */

function getSensorUnit(sensor) {
  return (
    SENSOR_CONFIG[sensor]?.unit ||
    "%"
  );
}

/* =====================================================
   FORMAT DATE/TIME
   ===================================================== */

function formatSMSDateTime(
  date = new Date()
) {
  try {
    return new Date(date).toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: true,
      }
    );
  } catch (error) {
    return new Date(date).toISOString();
  }
}

/* =====================================================
   FORMAT SENSOR NAME
   ===================================================== */

function formatSensorName(sensor) {
  const value = String(
    sensor || ""
  ).trim();

  if (!value) {
    return "Sensor";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

/* =====================================================
   FORMAT SENSOR VALUE
   ===================================================== */

function formatSensorValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "N/A";
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return Number.isInteger(
      numericValue
    )
      ? String(numericValue)
      : numericValue.toFixed(2);
  }

  return String(value);
}

/* =====================================================
   GET TELEMETRY VALUE
   ===================================================== */

function getTelemetryValue(
  telemetry,
  sensor
) {
  if (!telemetry) {
    return "N/A";
  }

  const value =
    telemetry[sensor];

  return formatSensorValue(value);
}

/* =====================================================
   CHECK LEGACY MESSAGE
   ===================================================== */

function isLegacyWarningMessage(
  message
) {
  if (typeof message !== "string") {
    return true;
  }

  const normalized =
    message.trim();

  if (!normalized) {
    return true;
  }

  return (
    normalized ===
    LEGACY_SMS_MESSAGES.warning
  );
}

function isLegacyDangerMessage(
  message
) {
  if (typeof message !== "string") {
    return true;
  }

  const normalized =
    message.trim();

  if (!normalized) {
    return true;
  }

  return (
    normalized ===
    LEGACY_SMS_MESSAGES.danger
  );
}

/* =====================================================
   BUILD SMS MESSAGE
   ===================================================== */

function buildCustomSMSMessage({
  deviceId,
  rule,
  value,
  alert,
  settings,
  telemetry,
}) {
  const sensor = String(
    rule.sensor || ""
  )
    .trim()
    .toLowerCase();

  const severity = String(
    rule.severity || "WARNING"
  )
    .trim()
    .toUpperCase();

  const sensorTitle =
    getSensorTitle(sensor);

  const unit =
    getSensorUnit(sensor);

  const threshold =
    Number.isFinite(
      Number(rule.threshold)
    )
      ? Number(rule.threshold)
      : "";

  const sensorName =
    formatSensorName(sensor);

  /* ---------------------------------------------------
     SELECT DEFAULT MESSAGE
     --------------------------------------------------- */

  const defaultMessage =
    severity === "WARNING"
      ? DEFAULT_SMS_MESSAGES.warning
      : DEFAULT_SMS_MESSAGES.danger;

  let customMessage =
    defaultMessage;

  /* ---------------------------------------------------
     WARNING MESSAGE
     --------------------------------------------------- */

  if (severity === "WARNING") {
    const configuredWarning =
      settings?.sms?.warningMessage;

    if (
      typeof configuredWarning ===
        "string" &&
      configuredWarning.trim() &&
      !isLegacyWarningMessage(
        configuredWarning
      )
    ) {
      customMessage =
        configuredWarning.trim();
    }
  }

  /* ---------------------------------------------------
     DANGER / CRITICAL MESSAGE
     --------------------------------------------------- */

  if (
    severity === "DANGER" ||
    severity === "CRITICAL"
  ) {
    const configuredDanger =
      settings?.sms?.dangerMessage;

    if (
      typeof configuredDanger ===
        "string" &&
      configuredDanger.trim() &&
      !isLegacyDangerMessage(
        configuredDanger
      )
    ) {
      customMessage =
        configuredDanger.trim();
    }
  }

  /* ---------------------------------------------------
     REASON
     --------------------------------------------------- */

  const reason =
    alert?.message ||
    getSensorMessage(
      sensor,
      value,
      threshold
    );

  /* ---------------------------------------------------
     ALL SENSOR READINGS
     --------------------------------------------------- */

  const temperature =
    getTelemetryValue(
      telemetry,
      "temperature"
    );

  const humidity =
    getTelemetryValue(
      telemetry,
      "humidity"
    );

  const smoke =
    getTelemetryValue(
      telemetry,
      "smoke"
    );

  const gas =
    getTelemetryValue(
      telemetry,
      "gas"
    );

  const noise =
    getTelemetryValue(
      telemetry,
      "noise"
    );

  const fire =
    getTelemetryValue(
      telemetry,
      "fire"
    );

  /* ---------------------------------------------------
     PLACEHOLDERS
     --------------------------------------------------- */

  const placeholders = {
    "{deviceId}":
      deviceId,

    "{sensor}":
      sensorName,

    "{sensorTitle}":
      sensorTitle,

    "{value}":
      formatSensorValue(value),

    "{unit}":
      unit,

    "{threshold}":
      String(threshold),

    "{severity}":
      severity,

    "{rule}":
      rule.name ||
      "Automation Rule",

    "{reason}":
      reason,

    "{time}":
      formatSMSDateTime(),

    "{temperature}":
      temperature,

    "{humidity}":
      humidity,

    "{smoke}":
      smoke,

    "{gas}":
      gas,

    "{noise}":
      noise,

    "{fire}":
      fire,
  };

  /* ---------------------------------------------------
     REPLACE PLACEHOLDERS
     --------------------------------------------------- */

  let message =
    customMessage;

  Object.entries(
    placeholders
  ).forEach(
    ([placeholder, replacement]) => {
      message = message
        .split(placeholder)
        .join(
          String(
            replacement ?? ""
          )
        );
    }
  );

  /* ---------------------------------------------------
     CLEAN MESSAGE
     --------------------------------------------------- */

  message = message
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  /* ---------------------------------------------------
     SMS LENGTH LIMIT
     --------------------------------------------------- */

  if (message.length > 1000) {
    message =
      message.substring(0, 997) +
      "...";
  }

  return message;
}

/* =====================================================
   CREATE AUTOMATION ALERT
   ===================================================== */

async function createAutomationAlert({
  deviceId,
  rule,
  value,
}) {
  const normalizedDeviceId =
    normalizeDeviceId(deviceId);

  const normalizedSensor =
    String(rule.sensor || "")
      .trim()
      .toLowerCase();

  /* ===================================================
     VALIDATE SENSOR
     =================================================== */

  if (
    !SENSOR_CONFIG[
      normalizedSensor
    ]
  ) {
    return {
      created: false,
      duplicate: false,
      alert: null,
      error:
        `Unsupported automation sensor: ${normalizedSensor}`,
    };
  }

  /* ===================================================
     CHECK EXISTING AUTOMATION ALERT
     =================================================== */

  const existingAlert =
    await Alert.findOne({
      deviceId:
        normalizedDeviceId,

      sensor:
        normalizedSensor,

      source: "AUTOMATION",

      status: {
        $in: [
          "ACTIVE",
          "ACKNOWLEDGED",
        ],
      },

      "metadata.ruleId":
        rule._id,
    }).sort({
      triggeredAt: -1,
    });

  /* ===================================================
     UPDATE EXISTING ALERT
     =================================================== */

  if (existingAlert) {
    existingAlert.lastSeenAt =
      new Date();

    existingAlert.lastValue =
      value;

    existingAlert.value =
      value;

    existingAlert.message =
      getSensorMessage(
        normalizedSensor,
        value,
        rule.threshold
      );

    existingAlert.metadata = {
      ...(existingAlert.metadata ||
        {}),

      ruleId:
        rule._id,

      ruleName:
        rule.name,

      operator:
        rule.operator,

      threshold:
        rule.threshold,

      source:
        "AUTOMATION",
    };

    await existingAlert.save();

    emitAlertUpdate({
      deviceId:
        normalizedDeviceId,

      action: "ACTIVE",

      alert:
        existingAlert.toObject(),
    });

    return {
      created: false,
      duplicate: true,
      alert: existingAlert,
    };
  }

  /* ===================================================
     CREATE NEW AUTOMATION ALERT
     =================================================== */

  const triggeredAt =
    new Date();

  const alert =
    await Alert.create({
      deviceId:
        normalizedDeviceId,

      sensor:
        normalizedSensor,

      severity:
        rule.severity,

      title:
        getSensorTitle(
          normalizedSensor
        ),

      message:
        getSensorMessage(
          normalizedSensor,
          value,
          rule.threshold
        ),

      source:
        "AUTOMATION",

      value,

      unit:
        getSensorUnit(
          normalizedSensor
        ),

      status:
        "ACTIVE",

      recordId:
        null,

      triggeredAt,

      lastSeenAt:
        triggeredAt,

      lastValue:
        value,

      metadata: {
        ruleId:
          rule._id,

        ruleName:
          rule.name,

        operator:
          rule.operator,

        threshold:
          rule.threshold,

        source:
          "AUTOMATION",
      },
    });

  console.log(
    `[AUTOMATION ALERT] ${rule.severity} | ${normalizedSensor} | ${normalizedDeviceId}`
  );

  emitAlertUpdate({
    deviceId:
      normalizedDeviceId,

    action:
      "CREATED",

    alert:
      alert.toObject(),
  });

  return {
    created: true,
    duplicate: false,
    alert,
  };
}

/* =====================================================
   CREATE AUTOMATION COMMAND
   ===================================================== */

async function createAutomationCommand({
  deviceId,
  command,
  rule,
  alert,
  value,
}) {
  const normalizedDeviceId =
    normalizeDeviceId(deviceId);

  /* ===================================================
     CHECK EXISTING PENDING AUTOMATION COMMAND
     =================================================== */

  const existingCommand =
    await Command.findOne({
      deviceId:
        normalizedDeviceId,

      command,

      status:
        "PENDING",

      source:
        "AUTOMATION",
    }).sort({
      createdAt: -1,
    });

  if (existingCommand) {
    return {
      created: false,
      duplicate: true,
      command:
        existingCommand,
    };
  }

  /* ===================================================
     CREATE COMMAND
     =================================================== */

  const newCommand =
    await Command.create({
      deviceId:
        normalizedDeviceId,

      command,

      source:
        "AUTOMATION",

      status:
        "PENDING",

      priority:
        COMMAND_PRIORITY[
          rule.severity
        ] || "NORMAL",

      mode:
        "AUTO",

      reason:
        `Automation rule: ${rule.name}`,

      parameters: {
        ruleId:
          rule._id,

        alertId:
          alert?._id || null,

        sensor:
          rule.sensor,

        value,

        threshold:
          rule.threshold,
      },
    });

  console.log(
    `[AUTOMATION COMMAND] ${normalizedDeviceId} | ${command} | ${rule.name}`
  );

  /* ===================================================
     REAL-TIME COMMAND EVENT
     =================================================== */

  emitCommandUpdate({
    deviceId:
      normalizedDeviceId,

    action:
      "CREATED",

    command:
      newCommand.toObject(),
  });

  /* ===================================================
     DASHBOARD REFRESH
     =================================================== */

  emitDashboardRefresh({
    reason:
      "AUTOMATION_COMMAND_CREATED",

    deviceId:
      normalizedDeviceId,

    command,
  });

  return {
    created: true,
    duplicate: false,
    command:
      newCommand,
  };
}

/* =====================================================
   PROCESS AUTOMATION SMS
   ===================================================== */

async function processAutomationSMS({
  deviceId,
  rule,
  value,
  alert,
  settings,
  telemetry,
}) {
  /* ===================================================
     RULE SMS SWITCH
     =================================================== */

  if (!rule.sendSMS) {
    return {
      created: 0,
      skipped: true,
      reason:
        "SMS not enabled for this automation rule",
    };
  }

  /* ===================================================
     GLOBAL SMS SWITCH
     =================================================== */

  const globalSmsEnabled =
    settings?.sms?.enabled !== false &&
    settings?.notifications?.sms !==
      false;

  if (!globalSmsEnabled) {
    return {
      created: 0,
      skipped: true,
      reason:
        "Global SMS notification is disabled",
    };
  }

  /* ===================================================
     CHECK PHONE NUMBERS
     =================================================== */

  const phoneNumbers =
    Array.isArray(
      settings?.sms?.phoneNumbers
    )
      ? settings.sms.phoneNumbers.filter(
          Boolean
        )
      : [];

  if (phoneNumbers.length === 0) {
    return {
      created: 0,
      skipped: true,
      reason:
        "No SMS recipients configured",
    };
  }

  /* ===================================================
     DANGER ONLY POLICY
     =================================================== */

  if (
    settings?.notifications
      ?.dangerOnly === true &&
    ![
      "DANGER",
      "CRITICAL",
    ].includes(
      String(
        rule.severity || ""
      ).toUpperCase()
    )
  ) {
    return {
      created: 0,
      skipped: true,
      reason:
        "SMS is configured for danger/critical alerts only",
    };
  }

  /* ===================================================
     SMS SERVICE DECISION
     =================================================== */

  const smsDecision =
    await shouldSendSMS({
      deviceId,

      severity:
        rule.severity,

      alertId:
        alert?._id || null,
    });

  if (!smsDecision.shouldSend) {
    console.log(
      `[AUTOMATION SMS SKIPPED] ${deviceId} | ${rule.name} | ${smsDecision.reason}`
    );

    return {
      created: 0,
      skipped: true,
      reason:
        smsDecision.reason,
    };
  }

  /* ===================================================
     BUILD CUSTOM SMS MESSAGE
     =================================================== */

  const message =
    buildCustomSMSMessage({
      deviceId,
      rule,
      value,
      alert,
      settings,
      telemetry,
    });

  console.log(
    `[AUTOMATION SMS MESSAGE] ${deviceId} | ${rule.severity} | ${message}`
  );

  /* ===================================================
     CREATE NOTIFICATION LOGS
     =================================================== */

  const smsLogs =
    await createSMSLogs({
      deviceId,

      message,

      alertId:
        alert?._id || null,
    });

  /* ===================================================
     SMS LOG RESULT
     =================================================== */

  if (smsLogs.length > 0) {
    console.log(
      `[AUTOMATION SMS] ${deviceId} | ${smsLogs.length} recipient(s) | ${rule.name}`
    );
  }

  return {
    created:
      smsLogs.length,

    skipped:
      false,

    reason:
      smsLogs.length > 0
        ? "SMS notification created"
        : "No SMS recipients configured",
  };
}

/* =====================================================
   GET SYSTEM SETTINGS
   ===================================================== */

async function getAutomationSettings() {
  const settings =
    await SystemSettings.findOne().lean();

  /* ===================================================
     NO SETTINGS DOCUMENT
     =================================================== */

  if (!settings) {
    return {
      automation: {
        enabled: true,
        manualOverride: true,
        firePump: true,
        gasExhaust: true,
        dangerBuzzer: true,
      },

      sms: {
        enabled: true,
        phoneNumbers: [],

        warningMessage:
          DEFAULT_SMS_MESSAGES.warning,

        dangerMessage:
          DEFAULT_SMS_MESSAGES.danger,

        cooldownSeconds: 60,
      },

      notifications: {
        browser: true,
        sms: true,
        dangerOnly: false,
      },
    };
  }

  /* ===================================================
     ENSURE SMS OBJECT
     =================================================== */

  if (!settings.sms) {
    settings.sms = {};
  }

  /* ===================================================
     PHONE NUMBERS
     =================================================== */

  if (
    !Array.isArray(
      settings.sms.phoneNumbers
    )
  ) {
    settings.sms.phoneNumbers = [];
  }

  /* ===================================================
     SMS ENABLED
     =================================================== */

  if (
    typeof settings.sms.enabled !==
    "boolean"
  ) {
    settings.sms.enabled = true;
  }

  /* ===================================================
     WARNING MESSAGE
     =================================================== */

  if (
    isLegacyWarningMessage(
      settings.sms.warningMessage
    )
  ) {
    settings.sms.warningMessage =
      DEFAULT_SMS_MESSAGES.warning;
  }

  /* ===================================================
     DANGER MESSAGE
     =================================================== */

  if (
    isLegacyDangerMessage(
      settings.sms.dangerMessage
    )
  ) {
    settings.sms.dangerMessage =
      DEFAULT_SMS_MESSAGES.danger;
  }

  /* ===================================================
     COOLDOWN
     =================================================== */

  if (
    !Number.isFinite(
      Number(
        settings.sms.cooldownSeconds
      )
    )
  ) {
    settings.sms.cooldownSeconds =
      60;
  }

  /* ===================================================
     ENSURE NOTIFICATION DEFAULTS
     =================================================== */

  if (!settings.notifications) {
    settings.notifications = {};
  }

  if (
    typeof settings.notifications.sms !==
    "boolean"
  ) {
    settings.notifications.sms =
      true;
  }

  if (
    typeof settings.notifications
      .dangerOnly !== "boolean"
  ) {
    settings.notifications.dangerOnly =
      false;
  }

  /* ===================================================
     ENSURE AUTOMATION DEFAULTS
     =================================================== */

  if (!settings.automation) {
    settings.automation = {};
  }

  if (
    typeof settings.automation.enabled !==
    "boolean"
  ) {
    settings.automation.enabled =
      true;
  }

  if (
    typeof settings.automation.manualOverride !==
    "boolean"
  ) {
    settings.automation.manualOverride =
      true;
  }

  if (
    typeof settings.automation.firePump !==
    "boolean"
  ) {
    settings.automation.firePump =
      true;
  }

  if (
    typeof settings.automation.gasExhaust !==
    "boolean"
  ) {
    settings.automation.gasExhaust =
      true;
  }

  if (
    typeof settings.automation.dangerBuzzer !==
    "boolean"
  ) {
    settings.automation.dangerBuzzer =
      true;
  }

  return settings;
}

/* =====================================================
   MAIN AUTOMATION PROCESSOR
   ===================================================== */

async function processAutomation(
  telemetry
) {
  const deviceId =
    normalizeDeviceId(
      telemetry?.deviceId
    );

  /* ===================================================
     INVALID DEVICE
     =================================================== */

  if (!deviceId) {
    return {
      enabled: false,
      rulesChecked: 0,
      triggeredRules: 0,
      alertsCreated: 0,
      commandsCreated: 0,
      commandsExisting: 0,
      smsNotificationsCreated: 0,
      smsNotificationsSkipped: 0,

      error:
        "Device ID is required",
    };
  }

  /* ===================================================
     GET SETTINGS
     =================================================== */

  const settings =
    await getAutomationSettings();

  /* ===================================================
     AUTOMATION MASTER SWITCH
     =================================================== */

  if (
    settings?.automation?.enabled ===
    false
  ) {
    console.log(
      `[AUTOMATION DISABLED] ${deviceId}`
    );

    return {
      enabled: false,
      rulesChecked: 0,
      triggeredRules: 0,
      alertsCreated: 0,
      commandsCreated: 0,
      commandsExisting: 0,
      smsNotificationsCreated: 0,
      smsNotificationsSkipped: 0,
    };
  }

  /* ===================================================
     FIND ENABLED AUTOMATION RULES
     =================================================== */

  const rules =
    await AutomationRule.find({
      enabled: true,

      $or: [
        {
          deviceId,
        },

        {
          deviceId: null,
        },
      ],
    }).sort({
      priority: 1,
    });

  /* ===================================================
     NO RULES
     =================================================== */

  if (!rules.length) {
    return {
      enabled: true,
      rulesChecked: 0,
      triggeredRules: 0,
      alertsCreated: 0,
      commandsCreated: 0,
      commandsExisting: 0,
      smsNotificationsCreated: 0,
      smsNotificationsSkipped: 0,
    };
  }

  /* ===================================================
     COUNTERS
     =================================================== */

  let triggeredRules = 0;
  let alertsCreated = 0;
  let commandsCreated = 0;
  let commandsExisting = 0;
  let smsNotificationsCreated = 0;
  let smsNotificationsSkipped = 0;

  /* ===================================================
     PROCESS EACH RULE
     =================================================== */

  for (const rule of rules) {
    const sensor =
      String(rule.sensor || "")
        .trim()
        .toLowerCase();

    const value =
      telemetry[sensor];

    /* =================================================
       SENSOR VALUE MISSING
       ================================================= */

    if (
      value === null ||
      value === undefined
    ) {
      continue;
    }

    /* =================================================
       NUMERIC CONVERSION
       ================================================= */

    const numericValue =
      Number(value);

    const numericThreshold =
      Number(rule.threshold);

    /* =================================================
       INVALID NUMERIC VALUES
       ================================================= */

    if (
      !Number.isFinite(
        numericValue
      ) ||
      !Number.isFinite(
        numericThreshold
      )
    ) {
      console.warn(
        `[AUTOMATION] Invalid value for rule: ${rule.name}`
      );

      continue;
    }

    /* =================================================
       CHECK CONDITION
       ================================================= */

    const triggered =
      compareValue(
        numericValue,
        rule.operator,
        numericThreshold
      );

    if (!triggered) {
      continue;
    }

    triggeredRules++;

    console.log(
      `[AUTOMATION TRIGGERED] ${deviceId} | ${rule.name} | ${sensor}=${numericValue}`
    );

    /* =================================================
       AUTOMATION ALERT
       ================================================= */

    let alert = null;

    if (rule.createAlert) {
      const alertResult =
        await createAutomationAlert({
          deviceId,

          rule,

          value:
            numericValue,
        });

      alert =
        alertResult.alert;

      if (
        alertResult.created
      ) {
        alertsCreated++;
      }
    }

    /* =================================================
       AUTOMATION COMMANDS
       ================================================= */

    const actions =
      Array.isArray(
        rule.actions
      )
        ? rule.actions
        : [];

    for (
      const command of actions
    ) {
      /* ---------------------------------------------
         FIRE → WATER PUMP
         --------------------------------------------- */

      if (
        command === "PUMP_ON" &&
        sensor === "fire" &&
        settings?.automation
          ?.firePump === false
      ) {
        continue;
      }

      /* ---------------------------------------------
         GAS/SMOKE → EXHAUST FAN
         --------------------------------------------- */

      if (
        command === "FAN_ON" &&
        (
          sensor === "gas" ||
          sensor === "smoke"
        ) &&
        settings?.automation
          ?.gasExhaust === false
      ) {
        continue;
      }

      /* ---------------------------------------------
         DANGER → BUZZER
         --------------------------------------------- */

      if (
        command === "BUZZER_ON" &&
        settings?.automation
          ?.dangerBuzzer === false
      ) {
        continue;
      }

      /* ---------------------------------------------
         CREATE COMMAND
         --------------------------------------------- */

      const commandResult =
        await createAutomationCommand({
          deviceId,

          command,

          rule,

          alert,

          value:
            numericValue,
        });

      if (
        commandResult.created
      ) {
        commandsCreated++;
      } else {
        commandsExisting++;
      }
    }

    /* =================================================
       AUTOMATION SMS

       IMPORTANT:
       Complete telemetry is passed here so all
       sensor placeholders can be replaced.
       ================================================= */

    const smsResult =
      await processAutomationSMS({
        deviceId,

        rule,

        value:
          numericValue,

        alert,

        settings,

        telemetry,
      });

    smsNotificationsCreated +=
      smsResult.created;

    if (
      smsResult.skipped
    ) {
      smsNotificationsSkipped++;
    }
  }

  /* ===================================================
     FINAL RESULT
     =================================================== */

  return {
    enabled: true,

    rulesChecked:
      rules.length,

    triggeredRules,

    alertsCreated,

    commandsCreated,

    commandsExisting,

    smsNotificationsCreated,

    smsNotificationsSkipped,
  };
}

/* =====================================================
   EXPORTS
   ===================================================== */

module.exports = {
  processAutomation,
};