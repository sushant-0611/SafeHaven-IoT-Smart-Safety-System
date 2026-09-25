const express = require("express");

const {
  createAutomationRule,
  getAutomationRules,
  getAutomationRuleById,
  updateAutomationRule,
  updateAutomationRuleStatus,
  deleteAutomationRule,
} = require("../controllers/automationRuleController");

const {
  authenticate,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

/*
 * ------------------------------------------
 * GET ALL AUTOMATION RULES
 * ------------------------------------------
 *
 * GET /api/automation-rules
 *
 * Optional query:
 *
 * ?deviceId=SAFEHAVEN-001
 * ?enabled=true
 * ?sensor=temperature
 *
 */

router.get(
  "/",
  authenticate,
  getAutomationRules
);

/*
 * ------------------------------------------
 * GET SINGLE AUTOMATION RULE
 * ------------------------------------------
 *
 * GET /api/automation-rules/:id
 *
 */

router.get(
  "/:id",
  authenticate,
  getAutomationRuleById
);

/*
 * ------------------------------------------
 * CREATE AUTOMATION RULE
 * ------------------------------------------
 *
 * POST /api/automation-rules
 *
 * ADMIN / SUPER_ADMIN only
 *
 */

router.post(
  "/",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  createAutomationRule
);

/*
 * ------------------------------------------
 * UPDATE AUTOMATION RULE
 * ------------------------------------------
 *
 * PUT /api/automation-rules/:id
 *
 * ADMIN / SUPER_ADMIN only
 *
 */

router.put(
  "/:id",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateAutomationRule
);

/*
 * ------------------------------------------
 * ENABLE / DISABLE RULE
 * ------------------------------------------
 *
 * PATCH /api/automation-rules/:id/status
 *
 * ADMIN / SUPER_ADMIN only
 *
 */

router.patch(
  "/:id/status",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateAutomationRuleStatus
);

/*
 * ------------------------------------------
 * DELETE AUTOMATION RULE
 * ------------------------------------------
 *
 * DELETE /api/automation-rules/:id
 *
 * ADMIN / SUPER_ADMIN only
 *
 */

router.delete(
  "/:id",
  authenticate,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  deleteAutomationRule
);

module.exports = router;