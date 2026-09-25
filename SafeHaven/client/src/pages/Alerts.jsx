import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  XCircle,
} from "lucide-react";

import api from "../services/api";

import {
  connectSocket,
  disconnectSocket,
  socket,
  subscribeToDevice,
  unsubscribeFromDevice,
} from "../services/socket";

import "../styles/alerts.css";

const DEVICE_ID = "SAFEHAVEN-001";

const STATUS_FILTERS = [
  "ALL",
  "ACTIVE",
  "ACKNOWLEDGED",
  "RESOLVED",
];

function formatDateTime(value) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeStatus(value) {
  const status = String(
    value || "ACTIVE"
  ).toUpperCase();

  if (status === "RESOLVED") {
    return "RESOLVED";
  }

  if (status === "ACKNOWLEDGED") {
    return "ACKNOWLEDGED";
  }

  return "ACTIVE";
}

function normalizeSeverity(value) {
  return String(
    value || "WARNING"
  ).toUpperCase() === "DANGER"
    ? "DANGER"
    : "WARNING";
}

function normalizeAlert(alert = {}, index = 0) {
  return {
    id:
      alert._id ||
      alert.id ||
      `alert-${index}-${Date.now()}`,

    deviceId:
      alert.deviceId || DEVICE_ID,

    sensor:
      alert.sensor || "unknown",

    severity: normalizeSeverity(
      alert.severity
    ),

    title:
      alert.title ||
      "Safety Alert",

    message:
      alert.message ||
      "A safety condition has been detected.",

    source:
      alert.source ||
      "SafeHaven Sensor",

    value:
      alert.value ??
      alert.lastValue ??
      "--",

    unit:
      alert.unit ||
      "%",

    timestamp:
      alert.triggeredAt ||
      alert.timestamp ||
      alert.createdAt ||
      null,

    lastSeenAt:
      alert.lastSeenAt ||
      null,

    status: normalizeStatus(
      alert.status
    ),

    acknowledgedAt:
      alert.acknowledgedAt ||
      null,

    resolvedAt:
      alert.resolvedAt ||
      null,

    acknowledgedBy:
      alert.acknowledgedBy ||
      null,

    resolvedBy:
      alert.resolvedBy ||
      null,

    resolutionNote:
      alert.resolutionNote ||
      "",
  };
}

function SeverityIcon({ severity }) {
  if (severity === "DANGER") {
    return <AlertCircle size={20} />;
  }

  return <AlertTriangle size={20} />;
}

function SummaryCard({
  type,
  count,
  label,
}) {
  const Icon =
    type === "danger"
      ? AlertCircle
      : type === "warning"
        ? AlertTriangle
        : type === "resolved"
          ? CheckCircle2
          : Bell;

  return (
    <div
      className={`alert-summary-card ${type}`}
    >
      <div className="summary-icon">
        <Icon size={21} />
      </div>

      <div className="summary-card-content">
        <strong>{count}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Alerts() {
  const [alerts, setAlerts] = useState([]);

  const [filter, setFilter] =
    useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [actionLoading, setActionLoading] =
    useState({});

  const [socketConnected, setSocketConnected] =
    useState(socket.connected);

  const [toast, setToast] =
    useState(null);

  const [resolutionAlert, setResolutionAlert] =
    useState(null);

  const [resolutionNote, setResolutionNote] =
    useState("");

  /*
   * Small notification popup.
   */
  const showToast = (
    message,
    type = "success"
  ) => {
    setToast({
      message,
      type,
    });

    window.clearTimeout(
      showToast.timeout
    );

    showToast.timeout =
      window.setTimeout(() => {
        setToast(null);
      }, 3500);
  };

  /*
   * Load persistent alerts from backend.
   */
  const loadAlerts = async (
    showLoader = true
  ) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      /*
       * Backend performs telemetry -> alert
       * synchronization before returning data.
       */
      const response = await api.get(
        `/alerts/${DEVICE_ID}`,
        {
          params: {
            limit: 500,
          },
        }
      );

      const rawData =
        response.data?.data;

      const normalized = Array.isArray(
        rawData
      )
        ? rawData.map(normalizeAlert)
        : [];

      normalized.sort(
        (a, b) =>
          new Date(
            b.timestamp || 0
          ) -
          new Date(
            a.timestamp || 0
          )
      );

      setAlerts(normalized);
    } catch (requestError) {
      console.error(
        "Failed to load SafeHaven alerts:",
        requestError
      );

      setError(
        requestError?.response?.data
          ?.message ||
          "Unable to load alerts from the backend."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
   * Initial load.
   */
  useEffect(() => {
    loadAlerts(true);
  }, []);

  /*
   * Socket.IO integration.
   */
  useEffect(() => {
    const handleSocketConnect = () => {
      setSocketConnected(true);

      subscribeToDevice(
        DEVICE_ID
      );

      /*
       * Refresh after reconnect so MongoDB
       * remains the source of truth.
       */
      loadAlerts(false);
    };

    const handleSocketDisconnect = () => {
      setSocketConnected(false);
    };

    const handleAlertUpdate = (
      payload
    ) => {
      const incomingRaw =
        payload?.data ||
        payload?.alert ||
        payload;

      if (
        incomingRaw?.deviceId &&
        incomingRaw.deviceId !== DEVICE_ID
      ) {
        return;
      }

      const incoming =
        normalizeAlert(
          incomingRaw
        );

      setAlerts(
        (currentAlerts) => {
          const index =
            currentAlerts.findIndex(
              (alert) =>
                alert.id ===
                incoming.id
            );

          if (index === -1) {
            return [
              incoming,
              ...currentAlerts,
            ].sort(
              (a, b) =>
                new Date(
                  b.timestamp || 0
                ) -
                new Date(
                  a.timestamp || 0
                )
            );
          }

          const updated = [
            ...currentAlerts,
          ];

          updated[index] = {
            ...updated[index],
            ...incoming,
          };

          return updated.sort(
            (a, b) =>
              new Date(
                b.timestamp || 0
              ) -
              new Date(
                a.timestamp || 0
              )
          );
        }
      );
    };

    const handleTelemetryUpdate = () => {
      /*
       * Backend is responsible for creating
       * persistent alerts.
       *
       * We reload after telemetry arrives.
       */
      loadAlerts(false);
    };

    socket.on(
      "connect",
      handleSocketConnect
    );

    socket.on(
      "disconnect",
      handleSocketDisconnect
    );

    socket.on(
      "alert:update",
      handleAlertUpdate
    );

    socket.on(
      "telemetry:update",
      handleTelemetryUpdate
    );

    socket.on(
      "device:telemetry",
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
        handleSocketConnect
      );

      socket.off(
        "disconnect",
        handleSocketDisconnect
      );

      socket.off(
        "alert:update",
        handleAlertUpdate
      );

      socket.off(
        "telemetry:update",
        handleTelemetryUpdate
      );

      socket.off(
        "device:telemetry",
        handleTelemetryUpdate
      );

      unsubscribeFromDevice(
        DEVICE_ID
      );

      disconnectSocket();
    };
  }, []);

  /*
   * Filter.
   */
  const filteredAlerts = useMemo(() => {
    if (filter === "ALL") {
      return alerts;
    }

    return alerts.filter(
      (alert) =>
        alert.status === filter
    );
  }, [alerts, filter]);

  /*
   * Summary.
   */
  const activeCount = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status ===
          "ACTIVE"
      ).length,
    [alerts]
  );

  const warningCount = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.severity ===
            "WARNING" &&
          alert.status !==
            "RESOLVED"
      ).length,
    [alerts]
  );

  const dangerCount = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.severity ===
            "DANGER" &&
          alert.status !==
            "RESOLVED"
      ).length,
    [alerts]
  );

  const resolvedCount = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status ===
          "RESOLVED"
      ).length,
    [alerts]
  );

  /*
   * ACKNOWLEDGE.
   */
  const acknowledgeAlert = async (
    alertId
  ) => {
    if (!alertId) {
      return;
    }

    try {
      setActionLoading(
        (current) => ({
          ...current,
          [alertId]: "ACKNOWLEDGE",
        })
      );

      const response =
        await api.patch(
          `/alerts/${alertId}/status`,
          {
            status:
              "ACKNOWLEDGED",
          }
        );

      const updatedAlert =
        normalizeAlert(
          response.data?.data
        );

      setAlerts(
        (currentAlerts) =>
          currentAlerts.map(
            (alert) =>
              alert.id === alertId
                ? updatedAlert
                : alert
          )
      );

      showToast(
        "Alert acknowledged successfully.",
        "success"
      );
    } catch (requestError) {
      console.error(
        "Acknowledge alert failed:",
        requestError
      );

      showToast(
        requestError?.response
          ?.data?.message ||
          "Unable to acknowledge alert.",
        "error"
      );
    } finally {
      setActionLoading(
        (current) => {
          const updated = {
            ...current,
          };

          delete updated[
            alertId
          ];

          return updated;
        }
      );
    }
  };

  /*
   * OPEN RESOLVE DIALOG.
   */
  const openResolveDialog = (
    alert
  ) => {
    setResolutionAlert(alert);
    setResolutionNote("");
  };

  /*
   * RESOLVE.
   */
  const resolveAlert = async () => {
    if (
      !resolutionAlert?.id
    ) {
      return;
    }

    const alertId =
      resolutionAlert.id;

    try {
      setActionLoading(
        (current) => ({
          ...current,
          [alertId]: "RESOLVE",
        })
      );

      const response =
        await api.patch(
          `/alerts/${alertId}/status`,
          {
            status:
              "RESOLVED",

            resolutionNote:
              resolutionNote.trim() ||
              "Alert resolved from SafeHaven Alerts Center.",
          }
        );

      const updatedAlert =
        normalizeAlert(
          response.data?.data
        );

      setAlerts(
        (currentAlerts) =>
          currentAlerts.map(
            (alert) =>
              alert.id === alertId
                ? updatedAlert
                : alert
          )
      );

      setResolutionAlert(null);
      setResolutionNote("");

      showToast(
        "Alert resolved successfully.",
        "success"
      );
    } catch (requestError) {
      console.error(
        "Resolve alert failed:",
        requestError
      );

      showToast(
        requestError?.response
          ?.data?.message ||
          "Unable to resolve alert.",
        "error"
      );
    } finally {
      setActionLoading(
        (current) => {
          const updated = {
            ...current,
          };

          delete updated[
            alertId
          ];

          return updated;
        }
      );
    }
  };

  return (
    <div className="alerts-page">

      {/* Toast */}
      {toast && (
        <div
          className={`alerts-toast ${toast.type}`}
        >
          {toast.type ===
          "success" ? (
            <CheckCircle2
              size={19}
            />
          ) : (
            <XCircle size={19} />
          )}

          <span>
            {toast.message}
          </span>
        </div>
      )}

      {/* Resolve Dialog */}
      {resolutionAlert && (
        <div
          className="alert-modal-overlay"
          onMouseDown={() =>
            setResolutionAlert(null)
          }
        >
          <div
            className="alert-resolve-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="alert-resolve-modal-icon">
              <CheckCircle2
                size={25}
              />
            </div>

            <div>
              <h3>
                Resolve Alert
              </h3>

              <p>
                Confirm that this
                alert has been handled
                and resolved.
              </p>
            </div>

            <label>
              Resolution note
            </label>

            <textarea
              value={resolutionNote}
              onChange={(event) =>
                setResolutionNote(
                  event.target.value
                )
              }
              placeholder="Optional resolution note..."
              rows={3}
            />

            <div className="alert-modal-actions">
              <button
                type="button"
                className="alert-modal-cancel"
                onClick={() =>
                  setResolutionAlert(
                    null
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="resolve-btn"
                onClick={
                  resolveAlert
                }
                disabled={
                  actionLoading[
                    resolutionAlert.id
                  ] === "RESOLVE"
                }
              >
                {actionLoading[
                  resolutionAlert.id
                ] === "RESOLVE"
                  ? "Resolving..."
                  : "Confirm Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="alerts-page-header">
        <div>
          <div className="alerts-title-row">
            <Bell size={23} />

            <h1>
              Alerts & Notifications
            </h1>
          </div>

          <p>
            Monitor safety events,
            warnings, and system
            notifications from your
            SafeHaven device.
          </p>
        </div>

        <div className="alerts-page-actions">

          <button
            type="button"
            className="alerts-refresh-btn"
            onClick={() =>
              loadAlerts(false)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "spin-icon"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="alerts-error-banner">
          <XCircle size={19} />

          <div>
            <strong>
              Backend connection issue
            </strong>

            <span>
              {error}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              loadAlerts(false)
            }
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <section className="alerts-summary">
        <SummaryCard
          type="active"
          count={activeCount}
          label="Active Alerts"
        />

        <SummaryCard
          type="danger"
          count={dangerCount}
          label="Danger Alerts"
        />

        <SummaryCard
          type="warning"
          count={warningCount}
          label="Warning Alerts"
        />

        <SummaryCard
          type="resolved"
          count={resolvedCount}
          label="Resolved"
        />
      </section>

      {/* Alert History */}
      <section className="alerts-content-card">
        <div className="alerts-content-header">
          <div>
            <h2>
              Alert History
            </h2>

            <p>
              Persistent safety events
              stored for{" "}
              {DEVICE_ID}.
            </p>
          </div>

          <div className="alerts-filter">
            <SlidersHorizontal
              size={17}
            />

            <select
              value={filter}
              onChange={(event) =>
                setFilter(
                  event.target.value
                )
              }
            >
              {STATUS_FILTERS.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status ===
                    "ALL"
                      ? "All Alerts"
                      : status
                          .charAt(
                            0
                          )
                          .toUpperCase() +
                        status
                          .slice(
                            1
                          )
                          .toLowerCase()}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        <div className="alerts-list">
          {loading ? (
            <div className="alerts-loading">
              <RefreshCw
                size={30}
                className="spin-icon"
              />

              <h3>
                Loading alerts...
              </h3>

              <p>
                Fetching persistent
                alert records from
                the SafeHaven backend.
              </p>
            </div>
          ) : (
            <>
              {filteredAlerts.map(
                (alert) => {
                  const loadingAction =
                    actionLoading[
                      alert.id
                    ];

                  return (
                    <article
                      key={alert.id}
                      className={`alert-item ${alert.severity.toLowerCase()} ${alert.status.toLowerCase()}`}
                    >
                      <div
                        className={`alert-severity-icon ${alert.severity.toLowerCase()}`}
                      >
                        <SeverityIcon
                          severity={
                            alert.severity
                          }
                        />
                      </div>

                      <div className="alert-details">
                        <div className="alert-title-row">
                          <h3>
                            {alert.title}
                          </h3>

                          <span
                            className={`severity-badge ${alert.severity.toLowerCase()}`}
                          >
                            {
                              alert.severity
                            }
                          </span>

                          <span
                            className={`alert-status-badge ${alert.status.toLowerCase()}`}
                          >
                            {
                              alert.status
                            }
                          </span>
                        </div>

                        <p>
                          {alert.message}
                        </p>

                        <div className="alert-meta">
                          <span>
                            <Activity
                              size={14}
                            />

                            {
                              alert.source
                            }
                          </span>

                          <span>
                            <strong>
                              Value:
                            </strong>{" "}
                            {
                              alert.value
                            }{" "}
                            {
                              alert.unit
                            }
                          </span>

                          <span>
                            <Clock3
                              size={14}
                            />

                            {formatDateTime(
                              alert.timestamp
                            )}
                          </span>

                          {alert.status ===
                            "ACKNOWLEDGED" &&
                            alert.acknowledgedAt && (
                              <span>
                                <CheckCircle2
                                  size={
                                    14
                                  }
                                />

                                Acknowledged{" "}
                                {formatDateTime(
                                  alert.acknowledgedAt
                                )}
                              </span>
                            )}

                          {alert.status ===
                            "RESOLVED" &&
                            alert.resolvedAt && (
                              <span>
                                <CheckCircle2
                                  size={
                                    14
                                  }
                                />

                                Resolved{" "}
                                {formatDateTime(
                                  alert.resolvedAt
                                )}
                              </span>
                            )}
                        </div>

                        {alert.status ===
                          "RESOLVED" &&
                          alert.resolutionNote && (
                            <div className="alert-resolution-note">
                              <strong>
                                Resolution:
                              </strong>{" "}
                              {
                                alert.resolutionNote
                              }
                            </div>
                          )}
                      </div>

                      <div className="alert-actions">
                        {alert.status ===
                          "ACTIVE" && (
                          <>
                            <button
                              type="button"
                              className="acknowledge-btn"
                              onClick={() =>
                                acknowledgeAlert(
                                  alert.id
                                )
                              }
                              disabled={
                                Boolean(
                                  loadingAction
                                )
                              }
                            >
                              <CheckCircle2
                                size={
                                  16
                                }
                              />

                              {loadingAction ===
                              "ACKNOWLEDGE"
                                ? "Saving..."
                                : "Acknowledge"}
                            </button>

                            <button
                              type="button"
                              className="resolve-btn"
                              onClick={() =>
                                openResolveDialog(
                                  alert
                                )
                              }
                              disabled={
                                Boolean(
                                  loadingAction
                                )
                              }
                            >
                              Resolve
                            </button>
                          </>
                        )}

                        {alert.status ===
                          "ACKNOWLEDGED" && (
                          <button
                            type="button"
                            className="resolve-btn"
                            onClick={() =>
                              openResolveDialog(
                                alert
                              )
                            }
                            disabled={
                              Boolean(
                                loadingAction
                              )
                            }
                          >
                            Resolve
                          </button>
                        )}

                        {alert.status ===
                          "RESOLVED" && (
                          <span className="resolved-label">
                            <CheckCircle2
                              size={16}
                            />

                            Resolved
                          </span>
                        )}
                      </div>
                    </article>
                  );
                }
              )}

              {filteredAlerts.length ===
                0 && (
                <div className="no-alerts">
                  <CheckCircle2
                    size={42}
                  />

                  <h3>
                    No alerts found
                  </h3>

                  <p>
                    There are no alerts
                    matching the selected
                    filter.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Information */}
      <section className="alerts-info-grid">
        <div className="alerts-info-card">
          <div className="info-card-icon danger">
            <AlertCircle
              size={20}
            />
          </div>

          <div>
            <strong>
              Danger Alerts
            </strong>

            <p>
              Critical sensor
              conditions that cross
              configured danger
              thresholds and may
              require immediate
              attention.
            </p>
          </div>
        </div>

        <div className="alerts-info-card">
          <div className="info-card-icon warning">
            <AlertTriangle
              size={20}
            />
          </div>

          <div>
            <strong>
              Warning Alerts
            </strong>

            <p>
              Sensor values that reach
              configured warning
              thresholds and require
              monitoring.
            </p>
          </div>
        </div>
      </section>

      <div className="alerts-data-note">
        <Bell size={16} />

        <span>
          Alert records are persisted
          in MongoDB. Acknowledge and
          Resolve actions update the
          backend and remain available
          after page refresh.
        </span>
      </div>
    </div>
  );
}

export default Alerts;