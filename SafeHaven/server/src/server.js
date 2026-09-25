const http = require("http");

const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/db");

const {
  initializeSocket,
} = require("./services/socketService");

const {
  startOfflineMonitor,
} = require("./services/offlineMonitor");

const {
  startNotificationProcessor,
} = require("./services/notificationProcessor");


async function startServer() {
  try {
    // ----------------------------------------------------------
    // Connect MongoDB
    // ----------------------------------------------------------

    await connectDatabase();


    // ----------------------------------------------------------
    // Create HTTP Server
    // ----------------------------------------------------------

    const server = http.createServer(app);


    // ----------------------------------------------------------
    // Initialize Socket.IO
    // ----------------------------------------------------------

    initializeSocket(server);


    // ----------------------------------------------------------
    // Start Server
    // ----------------------------------------------------------

    server.listen(env.port, "0.0.0.0", () => {
      console.log("");

      console.log("====================================");
      console.log("       SAFEHAVEN API SERVER");
      console.log("====================================");

      console.log(
        `Server: http://localhost:${env.port}`
      );

      console.log(
        `Health: http://localhost:${env.port}/api/health`
      );

      console.log(
        `ESP32 API: http://<LAPTOP-IP>:${env.port}/api`
      );

      console.log(
        `Environment: ${env.nodeEnv}`
      );

      console.log("====================================");
      console.log("       SOCKET.IO ENABLED");
      console.log("====================================");

      console.log(
        `Socket.IO: http://localhost:${env.port}`
      );

      console.log("====================================");
      console.log("        SERVER READY");
      console.log("====================================");

      console.log("");

      console.log(
        "Waiting for ESP32 telemetry..."
      );

      console.log("");


      // --------------------------------------------------------
      // Start Device Online/Offline Monitor
      // --------------------------------------------------------

      startOfflineMonitor();


      // --------------------------------------------------------
      // Start Notification Processor
      // --------------------------------------------------------

      startNotificationProcessor();
    });


    // ----------------------------------------------------------
    // Server Error Handler
    // ----------------------------------------------------------

    server.on("error", (error) => {
      console.error("");

      console.error(
        "SafeHaven HTTP server error:"
      );

      console.error(error);
    });


    // ----------------------------------------------------------
    // Graceful Shutdown
    // ----------------------------------------------------------

    const shutdown = (signal) => {
      console.log("");

      console.log(
        `Received ${signal}. Shutting down SafeHaven server...`
      );


      // Stop accepting new HTTP connections
      server.close(() => {
        console.log(
          "SafeHaven HTTP server stopped."
        );

        process.exit(0);
      });
    };


    process.on(
      "SIGINT",
      () => shutdown("SIGINT")
    );

    process.on(
      "SIGTERM",
      () => shutdown("SIGTERM")
    );

  } catch (error) {
    console.error("");

    console.error(
      "SafeHaven server startup failed."
    );

    console.error(error);

    process.exit(1);
  }
}


// ------------------------------------------------------------
// Start SafeHaven Server
// ------------------------------------------------------------

startServer();