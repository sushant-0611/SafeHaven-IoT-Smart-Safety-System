const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");

const deviceRoutes = require("./routes/deviceRoutes");
const authRoutes = require("./routes/authRoutes");
const commandRoutes = require("./routes/commandRoutes");
const systemSettingsRoutes = require("./routes/systemSettingsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const deviceEventRoutes = require("./routes/deviceEventRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const automationRuleRoutes = require("./routes/automationRuleRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const activityRoutes = require("./routes/activity.routes");
const alertRoutes = require("./routes/alert.routes");

const app = express();

// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

// ======================================================
// SECURITY
// ======================================================

app.use(helmet());

// ======================================================
// LOGGING
// ======================================================

app.use(morgan("dev"));

// ======================================================
// COOKIE PARSER
// ======================================================

app.use(cookieParser());

// ======================================================
// BODY PARSERS
// ======================================================

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ======================================================
// API RATE LIMITER
// ======================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

// ======================================================
// ROOT ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SafeHaven API is running",
    version: "1.0.0",
  });
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "SafeHaven API",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/commands", commandRoutes);
app.use("/api/settings", systemSettingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/device-events", deviceEventRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/automation-rules", automationRuleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/alerts", alertRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((error, req, res, next) => {
  console.error("Global API error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(error.status || 500).json({
    success: false,
    message:
      error.message || "Internal server error",
  });
});

// ======================================================
// EXPORT APP
// ======================================================

module.exports = app;