const {
  checkOfflineDevices,
} = require("./deviceStatusService");

let monitorInterval = null;

function startOfflineMonitor() {
  if (monitorInterval) {
    console.log(
      "[OFFLINE MONITOR] Already running."
    );
    return;
  }

  console.log(
    "[OFFLINE MONITOR] Starting device offline monitor..."
  );

  // First check after 10 seconds.
  monitorInterval = setInterval(async () => {
    const result = await checkOfflineDevices();

    console.log(
      `[OFFLINE MONITOR] Checked: ${result.checked} | Offline: ${result.markedOffline}`
    );
  }, 10 * 1000);

  console.log(
    "[OFFLINE MONITOR] Interval: 10 seconds"
  );
}

function stopOfflineMonitor() {
  if (!monitorInterval) {
    return;
  }

  clearInterval(monitorInterval);
  monitorInterval = null;

  console.log(
    "[OFFLINE MONITOR] Monitor stopped."
  );
}

module.exports = {
  startOfflineMonitor,
  stopOfflineMonitor,
};