const mongoose = require("mongoose");

const AutomationRule = require("../models/AutomationRule");

const VALID_SENSORS = [
  "temperature",
  "humidity",
  "smoke",
  "gas",
  "noise",
  "fire",
];

const VALID_OPERATORS = [
  ">",
  ">=",
  "<",
  "<=",
  "==",
];

const VALID_SEVERITIES = [
  "WARNING",
  "DANGER",
  "CRITICAL",
];

const VALID_ACTIONS = [
  "PUMP_ON",
  "PUMP_OFF",
  "FAN_ON",
  "FAN_OFF",
  "BUZZER_ON",
  "BUZZER_OFF",
  "RED_LED_ON",
  "RED_LED_OFF",
  "GREEN_LED_ON",
  "GREEN_LED_OFF",
];

/*
 * ------------------------------------------
 * VALIDATION HELPERS
 * ------------------------------------------
 */

function validateRuleData(data, isUpdate = false) {
  const errors = [];

  /*
   * NAME
   */

  if (
    !isUpdate ||
    data.name !== undefined
  ) {
    if (
      typeof data.name !== "string" ||
      !data.name.trim()
    ) {
      errors.push(
        "name is required and must be a non-empty string"
      );
    }
  }

  /*
   * SENSOR
   */

  if (
    !isUpdate ||
    data.sensor !== undefined
  ) {
    if (
      !VALID_SENSORS.includes(
        data.sensor
      )
    ) {
      errors.push(
        `sensor must be one of: ${VALID_SENSORS.join(", ")}`
      );
    }
  }

  /*
   * OPERATOR
   */

  if (
    !isUpdate ||
    data.operator !== undefined
  ) {
    if (
      !VALID_OPERATORS.includes(
        data.operator
      )
    ) {
      errors.push(
        `operator must be one of: ${VALID_OPERATORS.join(", ")}`
      );
    }
  }

  /*
   * THRESHOLD
   */

  if (
    !isUpdate ||
    data.threshold !== undefined
  ) {
    const threshold =
      Number(data.threshold);

    if (!Number.isFinite(threshold)) {
      errors.push(
        "threshold must be a valid number"
      );
    }
  }

  /*
   * SEVERITY
   */

  if (
    data.severity !== undefined &&
    !VALID_SEVERITIES.includes(
      data.severity
    )
  ) {
    errors.push(
      `severity must be one of: ${VALID_SEVERITIES.join(", ")}`
    );
  }

  /*
   * ACTIONS
   */

  if (
    data.actions !== undefined
  ) {
    if (
      !Array.isArray(data.actions)
    ) {
      errors.push(
        "actions must be an array"
      );
    } else {
      const invalidActions =
        data.actions.filter(
          (action) =>
            !VALID_ACTIONS.includes(
              action
            )
        );

      if (
        invalidActions.length > 0
      ) {
        errors.push(
          `Invalid actions: ${invalidActions.join(", ")}`
        );
      }
    }
  }

  /*
   * BOOLEAN FIELDS
   */

  const booleanFields = [
    "sendSMS",
    "createAlert",
    "enabled",
  ];

  for (
    const field of booleanFields
  ) {
    if (
      data[field] !== undefined &&
      typeof data[field] !==
        "boolean"
    ) {
      errors.push(
        `${field} must be a boolean`
      );
    }
  }

  /*
   * PRIORITY
   */

  if (
    data.priority !== undefined
  ) {
    const priority =
      Number(data.priority);

    if (
      !Number.isInteger(priority) ||
      priority < 0
    ) {
      errors.push(
        "priority must be a non-negative integer"
      );
    }
  }

  /*
   * DEVICE ID
   */

  if (
    data.deviceId !== undefined &&
    data.deviceId !== null &&
    typeof data.deviceId !==
      "string"
  ) {
    errors.push(
      "deviceId must be a string or null"
    );
  }

  return errors;
}

/*
 * ------------------------------------------
 * CREATE AUTOMATION RULE
 * ------------------------------------------
 *
 * POST /api/automation-rules
 *
 */

async function createAutomationRule(
  req,
  res
) {
  try {
    const errors =
      validateRuleData(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule",
        errors,
      });
    }

    const {
      name,
      description,
      deviceId,
      sensor,
      operator,
      threshold,
      severity,
      actions,
      sendSMS,
      createAlert,
      enabled,
      priority,
    } = req.body;

    const normalizedDeviceId =
      deviceId
        ? String(deviceId)
            .trim()
            .toUpperCase()
        : null;

    /*
     * Prevent duplicate rule names
     * for the same device.
     */

    const existingRule =
      await AutomationRule.findOne({
        name: name.trim(),
        deviceId:
          normalizedDeviceId,
      });

    if (existingRule) {
      return res.status(409).json({
        success: false,
        message:
          "An automation rule with this name already exists for this device",
      });
    }

    const rule =
      await AutomationRule.create({
        name: name.trim(),

        description:
          description !== undefined
            ? String(description).trim()
            : "",

        deviceId:
          normalizedDeviceId,

        sensor,

        operator,

        threshold:
          Number(threshold),

        severity:
          severity || "WARNING",

        actions:
          Array.isArray(actions)
            ? actions
            : [],

        sendSMS:
          sendSMS !== undefined
            ? sendSMS
            : false,

        createAlert:
          createAlert !== undefined
            ? createAlert
            : true,

        enabled:
          enabled !== undefined
            ? enabled
            : true,

        priority:
          priority !== undefined
            ? Number(priority)
            : 100,
      });

    console.log(
      `[AUTOMATION RULE CREATED] ${rule.name} | ${rule._id}`
    );

    return res.status(201).json({
      success: true,
      message:
        "Automation rule created successfully",
      data: rule,
    });
  } catch (error) {
    console.error(
      "Create automation rule error:",
      error
    );

    if (
      error.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create automation rule",
      error: error.message,
    });
  }
}

/*
 * ------------------------------------------
 * GET ALL AUTOMATION RULES
 * ------------------------------------------
 *
 * GET /api/automation-rules
 *
 * Optional:
 *
 * ?deviceId=SAFEHAVEN-001
 * ?enabled=true
 * ?sensor=temperature
 *
 */

async function getAutomationRules(
  req,
  res
) {
  try {
    const {
      deviceId,
      enabled,
      sensor,
    } = req.query;

    const filter = {};

    /*
     * Device filter
     */

    if (deviceId) {
      filter.$or = [
        {
          deviceId:
            String(deviceId)
              .trim()
              .toUpperCase(),
        },
        {
          deviceId: null,
        },
      ];
    }

    /*
     * Enabled filter
     */

    if (enabled !== undefined) {
      if (
        !["true", "false"].includes(
          enabled
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "enabled must be true or false",
        });
      }

      filter.enabled =
        enabled === "true";
    }

    /*
     * Sensor filter
     */

    if (sensor) {
      if (
        !VALID_SENSORS.includes(
          sensor
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Invalid sensor. Allowed values: ${VALID_SENSORS.join(", ")}`,
        });
      }

      filter.sensor = sensor;
    }

    const rules =
      await AutomationRule.find(
        filter
      ).sort({
        priority: 1,
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,
      count: rules.length,
      data: rules,
    });
  } catch (error) {
    console.error(
      "Get automation rules error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch automation rules",
      error: error.message,
    });
  }
}

/*
 * ------------------------------------------
 * GET SINGLE AUTOMATION RULE
 * ------------------------------------------
 *
 * GET /api/automation-rules/:id
 *
 */

async function getAutomationRuleById(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule ID",
      });
    }

    const rule =
      await AutomationRule.findById(
        id
      );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message:
          "Automation rule not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    console.error(
      "Get automation rule error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch automation rule",
      error: error.message,
    });
  }
}

/*
 * ------------------------------------------
 * UPDATE AUTOMATION RULE
 * ------------------------------------------
 *
 * PUT /api/automation-rules/:id
 *
 */

async function updateAutomationRule(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule ID",
      });
    }

    const errors =
      validateRuleData(
        req.body,
        true
      );

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule",
        errors,
      });
    }

    const rule =
      await AutomationRule.findById(
        id
      );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message:
          "Automation rule not found",
      });
    }

    /*
     * Update only supplied fields.
     */

    if (
      req.body.name !== undefined
    ) {
      rule.name =
        String(
          req.body.name
        ).trim();
    }

    if (
      req.body.description !==
      undefined
    ) {
      rule.description =
        String(
          req.body.description
        ).trim();
    }

    if (
      req.body.deviceId !==
      undefined
    ) {
      rule.deviceId =
        req.body.deviceId
          ? String(
              req.body.deviceId
            )
              .trim()
              .toUpperCase()
          : null;
    }

    if (
      req.body.sensor !==
      undefined
    ) {
      rule.sensor =
        req.body.sensor;
    }

    if (
      req.body.operator !==
      undefined
    ) {
      rule.operator =
        req.body.operator;
    }

    if (
      req.body.threshold !==
      undefined
    ) {
      rule.threshold =
        Number(
          req.body.threshold
        );
    }

    if (
      req.body.severity !==
      undefined
    ) {
      rule.severity =
        req.body.severity;
    }

    if (
      req.body.actions !==
      undefined
    ) {
      rule.actions =
        req.body.actions;
    }

    if (
      req.body.sendSMS !==
      undefined
    ) {
      rule.sendSMS =
        req.body.sendSMS;
    }

    if (
      req.body.createAlert !==
      undefined
    ) {
      rule.createAlert =
        req.body.createAlert;
    }

    if (
      req.body.enabled !==
      undefined
    ) {
      rule.enabled =
        req.body.enabled;
    }

    if (
      req.body.priority !==
      undefined
    ) {
      rule.priority =
        Number(
          req.body.priority
        );
    }

    await rule.save();

    console.log(
      `[AUTOMATION RULE UPDATED] ${rule.name} | ${rule._id}`
    );

    return res.status(200).json({
      success: true,
      message:
        "Automation rule updated successfully",
      data: rule,
    });
  } catch (error) {
    console.error(
      "Update automation rule error:",
      error
    );

    if (
      error.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update automation rule",
      error: error.message,
    });
  }
}

/*
 * ------------------------------------------
 * ENABLE / DISABLE AUTOMATION RULE
 * ------------------------------------------
 *
 * PATCH /api/automation-rules/:id/status
 *
 * Body:
 *
 * {
 *   "enabled": true
 * }
 *
 */

async function updateAutomationRuleStatus(
  req,
  res
) {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule ID",
      });
    }

    if (
      typeof enabled !==
      "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "enabled must be a boolean",
      });
    }

    const rule =
      await AutomationRule.findByIdAndUpdate(
        id,
        {
          $set: {
            enabled,
          },
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message:
          "Automation rule not found",
      });
    }

    console.log(
      `[AUTOMATION RULE STATUS] ${rule.name} | enabled=${rule.enabled}`
    );

    return res.status(200).json({
      success: true,
      message: rule.enabled
        ? "Automation rule enabled successfully"
        : "Automation rule disabled successfully",
      data: rule,
    });
  } catch (error) {
    console.error(
      "Update automation rule status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update automation rule status",
      error: error.message,
    });
  }
}

/*
 * ------------------------------------------
 * DELETE AUTOMATION RULE
 * ------------------------------------------
 *
 * DELETE /api/automation-rules/:id
 *
 */

async function deleteAutomationRule(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid automation rule ID",
      });
    }

    const rule =
      await AutomationRule.findByIdAndDelete(
        id
      );

    if (!rule) {
      return res.status(404).json({
        success: false,
        message:
          "Automation rule not found",
      });
    }

    console.log(
      `[AUTOMATION RULE DELETED] ${rule.name} | ${rule._id}`
    );

    return res.status(200).json({
      success: true,
      message:
        "Automation rule deleted successfully",
      data: {
        id: rule._id,
        name: rule.name,
      },
    });
  } catch (error) {
    console.error(
      "Delete automation rule error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete automation rule",
      error: error.message,
    });
  }
}

module.exports = {
  createAutomationRule,
  getAutomationRules,
  getAutomationRuleById,
  updateAutomationRule,
  updateAutomationRuleStatus,
  deleteAutomationRule,
};