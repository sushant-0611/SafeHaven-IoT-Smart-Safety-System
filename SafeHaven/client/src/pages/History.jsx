import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Flame,
  RefreshCw,
  RotateCcwClock,
  Search,
  ShieldAlert,
  Thermometer,
  Volume2,
  Waves,
  Wind,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import "../styles/history.css";

import api from "../services/api";

import { useSocket } from "../context/SocketContext";

const DEVICE_ID = "SAFEHAVEN-001";

const PAGE_SIZE = 10;

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
  if (!value) {
    return {
      date: "--",
      time: "--",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "--",
      time: "--",
    };
  }

  return {
    date: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

function formatNumber(value, decimals = 1) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return "--";
  }

  return number.toFixed(decimals);
}

function normalizeStatus(status) {
  const value = String(status || "SAFE").toUpperCase();

  if (
    value === "DANGER" ||
    value === "WARNING" ||
    value === "SAFE"
  ) {
    return value;
  }

  return "SAFE";
}

function getFireStatus(value) {
  if (
    typeof value === "string" &&
    ["SAFE", "WARNING", "DANGER"].includes(
      value.toUpperCase()
    )
  ) {
    return value.toUpperCase();
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "SAFE";
  }

  if (numericValue >= 70) {
    return "DANGER";
  }

  if (numericValue >= 50) {
    return "WARNING";
  }

  return "SAFE";
}

function getFireLabel(value) {
  const status = getFireStatus(value);

  if (status === "DANGER") {
    return "DETECTED";
  }

  if (status === "WARNING") {
    return "WARNING";
  }

  return "SAFE";
}

function getStatusIcon(status) {
  switch (status) {
    case "DANGER":
      return ShieldAlert;

    case "WARNING":
      return AlertTriangle;

    case "SAFE":
    default:
      return CheckCircle2;
  }
}

/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({ status }) {
  const normalizedStatus = normalizeStatus(status);

  const Icon = getStatusIcon(
    normalizedStatus
  );

  const label =
    normalizedStatus === "DANGER"
      ? "Danger"
      : normalizedStatus === "WARNING"
        ? "Warning"
        : "Safe";

  return (
    <span
      className={`history-status ${normalizedStatus.toLowerCase()}`}
    >
      <Icon size={14} />
      {label}
    </span>
  );
}

/* =========================================================
   OUTPUT BADGE
========================================================= */

function OutputBadge({ value }) {
  const isOn =
    value === true ||
    String(value).toUpperCase() === "ON";

  return (
    <span
      className={`output-badge ${
        isOn ? "on" : "off"
      }`}
    >
      <span />
      {isOn ? "ON" : "OFF"}
    </span>
  );
}

/* =========================================================
   FIRE BADGE
========================================================= */

function FireBadge({ value }) {
  const status = getFireStatus(value);
  const label = getFireLabel(value);

  return (
    <span
      className={`fire-status ${status.toLowerCase()}`}
    >
      <Flame size={14} />
      {label}
    </span>
  );
}

/* =========================================================
   HISTORY PAGE
========================================================= */

function History() {
  const { socket } = useSocket();

  /* =======================================================
     STATE
  ======================================================= */

  const [historyData, setHistoryData] =
    useState([]);

  const [totalRecords, setTotalRecords] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* Filters */

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [dateFilter, setDateFilter] =
    useState("");

  const [filtersApplied, setFiltersApplied] =
    useState({
      search: "",
      status: "ALL",
      date: "",
    });

  /* Pagination */

  const [currentPage, setCurrentPage] =
    useState(1);

  /* =======================================================
     LOAD HISTORY
  ======================================================= */

  const loadHistory = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await api.get(
          `/devices/${DEVICE_ID}/history`,
          {
            params: {
              limit: 1000,
            },
          }
        );

        if (
          response.data?.success
        ) {
          const records =
            Array.isArray(
              response.data?.data
            )
              ? response.data.data
              : [];

          setHistoryData(records);

          setTotalRecords(
            Number(response.data?.count) ||
              records.length
          );
        } else {
          throw new Error(
            response.data?.message ||
              "Failed to load telemetry history."
          );
        }
      } catch (err) {
        console.error(
          "[HISTORY] Load error:",
          err.response?.data ||
            err.message
        );

        setError(
          err.response?.data?.message ||
            "Unable to load telemetry history."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /* =======================================================
     REALTIME TELEMETRY
  ======================================================= */

  useEffect(() => {
    if (!socket) {
      return;
    }

    function addRealtimeTelemetry(
      payload
    ) {
      const incoming =
        payload?.telemetry;

      if (!incoming) {
        return;
      }

      if (
        payload?.deviceId &&
        payload.deviceId !== DEVICE_ID
      ) {
        return;
      }

      const incomingTimestamp =
        incoming.timestamp ||
        new Date().toISOString();

      const realtimeRecord = {
        ...incoming,
        timestamp:
          incomingTimestamp,
      };

      setHistoryData(
        (previous) => {
          const exists =
            previous.some(
              (record) =>
                String(record._id) ===
                  String(incoming._id) ||
                (
                  record.timestamp &&
                  incoming.timestamp &&
                  new Date(
                    record.timestamp
                  ).getTime() ===
                    new Date(
                      incoming.timestamp
                    ).getTime()
                )
            );

          if (exists) {
            return previous;
          }

          return [
            realtimeRecord,
            ...previous,
          ].slice(0, 1000);
        }
      );

      setTotalRecords(
        (previous) => previous + 1
      );
    }

    socket.on(
      "telemetry:update",
      addRealtimeTelemetry
    );

    return () => {
      socket.off(
        "telemetry:update",
        addRealtimeTelemetry
      );
    };
  }, [socket]);

  /* =======================================================
     APPLY FILTERS
  ======================================================= */

  function handleApplyFilters() {
    setFiltersApplied({
      search: searchTerm.trim(),
      status: statusFilter,
      date: dateFilter,
    });

    setCurrentPage(1);
  }

  /* =======================================================
     RESET FILTERS
  ======================================================= */

  function handleResetFilters() {
    setSearchTerm("");
    setStatusFilter("ALL");
    setDateFilter("");

    setFiltersApplied({
      search: "",
      status: "ALL",
      date: "",
    });

    setCurrentPage(1);
  }

  /* =======================================================
     FILTERED DATA
  ======================================================= */

  const filteredRecords = useMemo(() => {
    const search =
      filtersApplied.search.toLowerCase();

    return historyData.filter(
      (record) => {
        const recordStatus =
          normalizeStatus(
            record.safetyStatus
          );

        /* Status */

        if (
          filtersApplied.status !== "ALL" &&
          recordStatus !==
            filtersApplied.status
        ) {
          return false;
        }

        /* Date */

        if (filtersApplied.date) {
          const recordDate =
            new Date(
              record.timestamp
            );

          if (
            Number.isNaN(
              recordDate.getTime()
            )
          ) {
            return false;
          }

          const localDate =
            recordDate
              .toLocaleDateString(
                "en-CA"
              );

          if (
            localDate !==
            filtersApplied.date
          ) {
            return false;
          }
        }

        /* Search */

        if (search) {
          const searchableText = [
            record.deviceId,
            record.safetyStatus,
            record.safetyReason,
            record.temperature,
            record.humidity,
            record.smoke,
            record.gas,
            record.noise,
            record.fire,
            record.pump ? "ON" : "OFF",
            record.fan ? "ON" : "OFF",
            record.buzzer
              ? "ON"
              : "OFF",
          ]
            .join(" ")
            .toLowerCase();

          if (
            !searchableText.includes(
              search
            )
          ) {
            return false;
          }
        }

        return true;
      }
    );
  }, [
    historyData,
    filtersApplied,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary = useMemo(() => {
    let safe = 0;
    let warning = 0;
    let danger = 0;

    historyData.forEach(
      (record) => {
        const status =
          normalizeStatus(
            record.safetyStatus
          );

        if (status === "DANGER") {
          danger += 1;
        } else if (
          status === "WARNING"
        ) {
          warning += 1;
        } else {
          safe += 1;
        }
      }
    );

    return {
      total: totalRecords || historyData.length,
      safe,
      warning,
      danger,
    };
  }, [
    historyData,
    totalRecords,
  ]);

  /* =======================================================
     PAGINATION
  ======================================================= */

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredRecords.length /
        PAGE_SIZE
    )
  );

  const paginatedRecords =
    useMemo(() => {
      const start =
        (currentPage - 1) *
        PAGE_SIZE;

      return filteredRecords.slice(
        start,
        start + PAGE_SIZE
      );
    }, [
      filteredRecords,
      currentPage,
    ]);

  useEffect(() => {
    if (
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  /* =======================================================
     PAGINATION NUMBERS
  ======================================================= */

  const paginationItems =
    useMemo(() => {
      if (totalPages <= 5) {
        return Array.from(
          {
            length: totalPages,
          },
          (_, index) => index + 1
        );
      }

      if (currentPage <= 3) {
        return [
          1,
          2,
          3,
          4,
          "...",
          totalPages,
        ];
      }

      if (
        currentPage >=
        totalPages - 2
      ) {
        return [
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        ];
      }

      return [
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages,
      ];
    }, [
      currentPage,
      totalPages,
    ]);

  /* =======================================================
     EXPORT CSV
  ======================================================= */

  function handleExportCSV() {
    if (
      filteredRecords.length === 0
    ) {
      return;
    }

    const headers = [
      "Timestamp",
      "Device ID",
      "Temperature",
      "Humidity",
      "Smoke",
      "Gas",
      "Noise",
      "Fire",
      "Safety Status",
      "Safety Reason",
      "Pump",
      "Fan",
      "Buzzer",
    ];

    const rows =
      filteredRecords.map(
        (record) => [
          record.timestamp || "",
          record.deviceId || DEVICE_ID,
          record.temperature ?? "",
          record.humidity ?? "",
          record.smoke ?? "",
          record.gas ?? "",
          record.noise ?? "",
          getFireLabel(record.fire),
          normalizeStatus(
            record.safetyStatus
          ),
          record.safetyReason || "",
          record.pump ? "ON" : "OFF",
          record.fan ? "ON" : "OFF",
          record.buzzer
            ? "ON"
            : "OFF",
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => {
            const text =
              String(value ?? "");

            return `"${text.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `safehaven-history-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /* =======================================================
     PAGE RANGE
  ======================================================= */

  const rangeStart =
    filteredRecords.length === 0
      ? 0
      : (currentPage - 1) *
          PAGE_SIZE +
        1;

  const rangeEnd = Math.min(
    currentPage * PAGE_SIZE,
    filteredRecords.length
  );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="history-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="history-header">
        <div>
          <div className="history-title-row">
            <RotateCcwClock size={23} />

            <h1>History</h1>
          </div>

          <p>
            Review historical sensor
            readings and SafeHaven
            system events.
          </p>
        </div>

        <div className="history-header-actions">
          <button
            type="button"
            className="history-refresh-button"
            onClick={() =>
              loadHistory(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "is-spinning"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            className="history-export-button"
            onClick={handleExportCSV}
            disabled={
              filteredRecords.length === 0
            }
          >
            <Download size={17} />

            Export CSV
          </button>
        </div>
      </header>

      {/* ==================================================
          ERROR
      ================================================== */}

      {error && (
        <div className="history-error">
          <AlertTriangle size={18} />

          <div>
            <strong>
              Unable to load history
            </strong>

            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              loadHistory(true)
            }
          >
            Try Again
          </button>
        </div>
      )}

      {/* ==================================================
          SUMMARY
      ================================================== */}

      <section className="history-summary-grid">

        <div className="history-summary-card">
          <div className="history-summary-icon blue">
            <Activity size={21} />
          </div>

          <div>
            <span>Total Records</span>

            <strong>
              {summary.total.toLocaleString(
                "en-IN"
              )}
            </strong>

            <small>
              From SafeHaven device
            </small>
          </div>
        </div>

        <div className="history-summary-card">
          <div className="history-summary-icon green">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <span>Safe Events</span>

            <strong>
              {summary.safe.toLocaleString(
                "en-IN"
              )}
            </strong>

            <small>
              Within safe limits
            </small>
          </div>
        </div>

        <div className="history-summary-card">
          <div className="history-summary-icon orange">
            <AlertTriangle size={21} />
          </div>

          <div>
            <span>Warning Events</span>

            <strong>
              {summary.warning.toLocaleString(
                "en-IN"
              )}
            </strong>

            <small>
              Attention required
            </small>
          </div>
        </div>

        <div className="history-summary-card">
          <div className="history-summary-icon red">
            <ShieldAlert size={21} />
          </div>

          <div>
            <span>Danger Events</span>

            <strong>
              {summary.danger.toLocaleString(
                "en-IN"
              )}
            </strong>

            <small>
              Critical conditions
            </small>
          </div>
        </div>

      </section>

      {/* ==================================================
          FILTER PANEL
      ================================================== */}

      <section className="history-filter-panel">

        <div className="history-filter-title">
          <div className="history-filter-icon">
            <Filter size={18} />
          </div>

          <div>
            <h2>
              Filter Records
            </h2>

            <span>
              Refine historical telemetry
              data
            </span>
          </div>
        </div>

        <div className="history-filters">

          {/* Search */}

          <div className="history-filter-group search-group">
            <label htmlFor="history-search">
              Search
            </label>

            <div className="history-input-wrapper">
              <Search size={17} />

              <input
                id="history-search"
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Search telemetry..."
              />
            </div>
          </div>

          {/* Status */}

          <div className="history-filter-group">
            <label htmlFor="history-status">
              Status
            </label>

            <select
              id="history-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All Status
              </option>

              <option value="SAFE">
                Safe
              </option>

              <option value="WARNING">
                Warning
              </option>

              <option value="DANGER">
                Danger
              </option>
            </select>
          </div>

          {/* Date */}

          <div className="history-filter-group">
            <label htmlFor="history-date">
              Date
            </label>

            <div className="history-input-wrapper">
              <CalendarDays size={17} />

              <input
                id="history-date"
                type="date"
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(
                    event.target.value
                  )
                }
              />
            </div>
          </div>

          {/* Apply */}

          <button
            type="button"
            className="history-filter-button"
            onClick={
              handleApplyFilters
            }
          >
            Apply Filters
          </button>

          {/* Reset */}

          <button
            type="button"
            className="history-reset-button"
            onClick={
              handleResetFilters
            }
          >
            Reset
          </button>

        </div>
      </section>

      {/* ==================================================
          TABLE PANEL
      ================================================== */}

      <section className="history-table-panel">

        <div className="history-table-header">
          <div>
            <h2>
              Telemetry Records
            </h2>

            <p>
              Historical sensor readings
              from {DEVICE_ID}
            </p>
          </div>

          <div className="history-record-count">
            {filteredRecords.length.toLocaleString(
              "en-IN"
            )}{" "}
            matching records
          </div>
        </div>

        {/* Loading */}

        {loading ? (
          <div className="history-loading">
            <RefreshCw
              size={22}
              className="is-spinning"
            />

            <strong>
              Loading telemetry history...
            </strong>

            <span>
              Fetching records from
              SafeHaven backend
            </span>
          </div>
        ) : filteredRecords.length ===
          0 ? (
          /* Empty */

          <div className="history-empty">
            <div className="history-empty-icon">
              <Search size={23} />
            </div>

            <h3>
              No records found
            </h3>

            <p>
              No telemetry records match
              the selected filters.
            </p>

            <button
              type="button"
              onClick={
                handleResetFilters
              }
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            {/* Table */}

            <div className="history-table-wrapper">
              <table className="history-table">

                <thead>
                  <tr>
                    <th>
                      Timestamp
                    </th>

                    <th>
                      <span className="table-heading">
                        <Thermometer
                          size={15}
                        />
                        Temp.
                      </span>
                    </th>

                    <th>
                      <span className="table-heading">
                        <Waves size={15} />
                        Humidity
                      </span>
                    </th>

                    <th>
                      <span className="table-heading">
                        <Wind size={15} />
                        Smoke
                      </span>
                    </th>

                    <th>
                      <span className="table-heading">
                        <Wind size={15} />
                        Gas
                      </span>
                    </th>

                    <th>
                      <span className="table-heading">
                        <Volume2
                          size={15}
                        />
                        Noise
                      </span>
                    </th>

                    <th>
                      <span className="table-heading">
                        <Flame size={15} />
                        Fire
                      </span>
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Pump
                    </th>

                    <th>
                      Fan
                    </th>

                    <th>
                      Buzzer
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRecords.map(
                    (record, index) => {
                      const {
                        date,
                        time,
                      } = formatDate(
                        record.timestamp
                      );

                      return (
                        <tr
                          key={
                            record._id ||
                            `${record.timestamp}-${index}`
                          }
                        >
                          {/* Timestamp */}

                          <td>
                            <div className="timestamp-cell">
                              <strong>
                                {date}
                              </strong>

                              <span>
                                {time}
                              </span>
                            </div>
                          </td>

                          {/* Temperature */}

                          <td>
                            <strong className="primary-reading">
                              {formatNumber(
                                record.temperature
                              )}
                              °C
                            </strong>
                          </td>

                          {/* Humidity */}

                          <td>
                            {formatNumber(
                              record.humidity,
                              0
                            )}
                            %
                          </td>

                          {/* Smoke */}

                          <td>
                            {formatNumber(
                              record.smoke,
                              0
                            )}
                            %
                          </td>

                          {/* Gas */}

                          <td>
                            {formatNumber(
                              record.gas,
                              0
                            )}
                            %
                          </td>

                          {/* Noise */}

                          <td>
                            {formatNumber(
                              record.noise,
                              0
                            )}
                            <small>
                              {" "}
                              dB
                            </small>
                          </td>

                          {/* Fire */}

                          <td>
                            <FireBadge
                              value={
                                record.fire
                              }
                            />
                          </td>

                          {/* Safety */}

                          <td>
                            <StatusBadge
                              status={
                                record.safetyStatus
                              }
                            />
                          </td>

                          {/* Pump */}

                          <td>
                            <OutputBadge
                              value={
                                record.pump
                              }
                            />
                          </td>

                          {/* Fan */}

                          <td>
                            <OutputBadge
                              value={
                                record.fan
                              }
                            />
                          </td>

                          {/* Buzzer */}

                          <td>
                            <OutputBadge
                              value={
                                record.buzzer
                              }
                            />
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>

              </table>
            </div>

            {/* ==================================================
                PAGINATION
            ================================================== */}

            <div className="history-pagination">

              <div className="pagination-summary">
                Showing{" "}
                <strong>
                  {rangeStart}–
                  {rangeEnd}
                </strong>{" "}
                of{" "}
                <strong>
                  {filteredRecords.length.toLocaleString(
                    "en-IN"
                  )}
                </strong>{" "}
                records
              </div>

              <div className="pagination-controls">

                <button
                  type="button"
                  className="pagination-button"
                  disabled={
                    currentPage === 1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  aria-label="Previous page"
                >
                  <ChevronLeft
                    size={17}
                  />
                </button>

                {paginationItems.map(
                  (item, index) =>
                    item === "..." ? (
                      <span
                        key={`dots-${index}`}
                        className="pagination-dots"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`pagination-number ${
                          currentPage ===
                          item
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setCurrentPage(
                            item
                          )
                        }
                      >
                        {item}
                      </button>
                    )
                )}

                <button
                  type="button"
                  className="pagination-button"
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                  aria-label="Next page"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>

              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default History;