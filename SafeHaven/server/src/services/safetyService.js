const SystemSettings = require("../models/SystemSettings");

/* =========================================================
   DEFAULT THRESHOLDS
   Used only if SystemSettings document/threshold is missing.
   ========================================================= */

const DEFAULT_THRESHOLDS = {
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
};

/* =========================================================
   SENSOR DISPLAY NAMES
   ========================================================= */

const SENSOR_NAMES = {
  temperature: "Temperature",
  humidity: "Humidity",
  smoke: "Smoke",
  gas: "Gas",
  noise: "Noise",
  fire: "Fire",
};

/* =========================================================
   GET SYSTEM THRESHOLDS
   ========================================================= */

async function getSafetyThresholds() {
  try {
    const settings = await SystemSettings.findOne()
      .sort({ createdAt: 1 })
      .select("thresholds")
      .lean();

    /*
      If settings do not exist, use safe project defaults.
    */

    if (!settings || !settings.thresholds) {
      return DEFAULT_THRESHOLDS;
    }

    /*
      Merge database thresholds with defaults.

      This prevents a missing individual sensor threshold
      from breaking safety evaluation.
    */

    return {
      temperature: {
        ...DEFAULT_THRESHOLDS.temperature,
        ...(settings.thresholds.temperature || {}),
      },

      humidity: {
        ...DEFAULT_THRESHOLDS.humidity,
        ...(settings.thresholds.humidity || {}),
      },

      smoke: {
        ...DEFAULT_THRESHOLDS.smoke,
        ...(settings.thresholds.smoke || {}),
      },

      gas: {
        ...DEFAULT_THRESHOLDS.gas,
        ...(settings.thresholds.gas || {}),
      },

      noise: {
        ...DEFAULT_THRESHOLDS.noise,
        ...(settings.thresholds.noise || {}),
      },

      fire: {
        ...DEFAULT_THRESHOLDS.fire,
        ...(settings.thresholds.fire || {}),
      },
    };
  } catch (error) {
    console.error(
      "Get safety thresholds error:",
      error
    );

    /*
      Safety system should continue operating even if
      settings cannot temporarily be read from MongoDB.

      Therefore fall back to the known project defaults.
    */

    return DEFAULT_THRESHOLDS;
  }
}

/* =========================================================
   SENSOR VALUE VALIDATION
   ========================================================= */

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value))
  );
}

/* =========================================================
   MAIN SAFETY EVALUATION
   =========================================================

   Returns:

   {
     status: "SAFE" | "WARNING" | "DANGER" | "CRITICAL",
     reason: "...",
     reasons: [...],
     thresholds: {...}
   }

   ========================================================= */

async function evaluateSafetyStatus(telemetry) {
  const {
    temperature,
    humidity,
    smoke,
    gas,
    noise,
    fire,
  } = telemetry || {};

  const thresholds =
    await getSafetyThresholds();

  const reasons = [];

  let status = "SAFE";

  /* =======================================================
     STATUS PRIORITY
     ======================================================= */

  function updateStatus(newStatus) {
    const priority = {
      SAFE: 0,
      WARNING: 1,
      DANGER: 2,
      CRITICAL: 3,
    };

    if (
      priority[newStatus] >
      priority[status]
    ) {
      status = newStatus;
    }
  }

  /* =======================================================
     TEMPERATURE
     ======================================================= */

  if (hasValue(temperature)) {
    const value = Number(temperature);

    const threshold =
      thresholds.temperature;

    if (value >= threshold.danger) {
      updateStatus("DANGER");

      reasons.push(
        `Dangerous temperature detected (${value}${threshold.unit})`
      );
    } else if (
      value >= threshold.warning
    ) {
      updateStatus("WARNING");

      reasons.push(
        `High temperature detected (${value}${threshold.unit})`
      );
    }
  }

  /* =======================================================
     HUMIDITY
     ======================================================= */

  if (hasValue(humidity)) {
    const value = Number(humidity);

    const threshold =
      thresholds.humidity;

    if (value >= threshold.danger) {
      updateStatus("DANGER");

      reasons.push(
        `Very high humidity detected (${value}${threshold.unit})`
      );
    } else if (
      value >= threshold.warning
    ) {
      updateStatus("WARNING");

      reasons.push(
        `High humidity detected (${value}${threshold.unit})`
      );
    }
  }

  /* =======================================================
     SMOKE
     ======================================================= */

  if (hasValue(smoke)) {
    const value = Number(smoke);

    const threshold =
      thresholds.smoke;

    if (value >= threshold.danger) {
      updateStatus("DANGER");

      reasons.push(
        `High smoke level detected (${value}${threshold.unit})`
      );
    } else if (
      value >= threshold.warning
    ) {
      updateStatus("WARNING");

      reasons.push(
        `Smoke detected (${value}${threshold.unit})`
      );
    }
  }

  /* =======================================================
     GAS
     ======================================================= */

  if (hasValue(gas)) {
    const value = Number(gas);

    const threshold =
      thresholds.gas;

    if (value >= threshold.danger) {
      updateStatus("DANGER");

      reasons.push(
        `Dangerous gas level detected (${value}${threshold.unit})`
      );
    } else if (
      value >= threshold.warning
    ) {
      updateStatus("WARNING");

      reasons.push(
        `Gas detected (${value}${threshold.unit})`
      );
    }
  }

  /* =======================================================
     NOISE
     ======================================================= */

  if (hasValue(noise)) {
    const value = Number(noise);

    const threshold =
      thresholds.noise;

    if (value >= threshold.danger) {
      updateStatus("DANGER");

      reasons.push(
        `Dangerous noise level detected (${value}${threshold.unit})`
      );
    } else if (
      value >= threshold.warning
    ) {
      updateStatus("WARNING");

      reasons.push(
        `High noise level detected (${value}${threshold.unit})`
      );
    }
  }

  /* =======================================================
     FIRE
     ======================================================= */

  if (hasValue(fire)) {
    const value = Number(fire);

    const threshold =
      thresholds.fire;

    /*
      Fire remains CRITICAL at the configured danger
      threshold, preserving the existing SafeHaven
      behaviour.
    */

    if (value >= threshold.danger) {
      updateStatus("CRITICAL");

      reasons.push(
        `Fire detected (${value}${threshold.unit})`
      );
    } else if (
      value >= threshold.warning
    ) {
      updateStatus("DANGER");

      reasons.push(
        `Possible fire detected (${value}${threshold.unit})`
      );
    }
  }

  /* =======================================================
     FINAL RESULT
     ======================================================= */

  return {
    status,

    reason:
      reasons.length > 0
        ? reasons.join("; ")
        : "Normal operating conditions",

    reasons,

    /*
      Returning thresholds is useful for the telemetry
      controller and alert engine, so they can use the
      exact thresholds that produced this decision.
    */

    thresholds,
  };
}

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  evaluateSafetyStatus,
  getSafetyThresholds,
};