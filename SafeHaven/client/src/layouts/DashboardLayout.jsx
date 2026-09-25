import {
  Radio,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../services/api";
import "../styles/dashboard-layout.css";

const DEVICE_ID = "SAFEHAVEN-001";

const navigationItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Live Monitoring",
    path: "/live-monitoring",
    icon: Radio,
  },
  {
    label: "History",
    path: "/history",
    icon: History,
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
  },
  {
    label: "Control Center",
    path: "/control",
    icon: SlidersHorizontal,
  },
  {
    label: "Alerts",
    path: "/alerts",
    icon: Bell,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

function DashboardLayout() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [esp32Connected, setEsp32Connected] = useState(false);

  /* =========================================================
     DEVICE STATUS
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    async function fetchDeviceStatus() {
      try {
        const response = await api.get(
          `/devices/${DEVICE_ID}/status`
        );

        if (!mounted) return;

        const responseData =
          response?.data?.data ||
          response?.data ||
          {};

        const status = String(
          responseData.status ||
            responseData.deviceStatus ||
            responseData.connectionStatus ||
            ""
        ).toLowerCase();

        const connected =
          responseData.connected === true ||
          responseData.online === true ||
          status === "online" ||
          status === "connected";

        setEsp32Connected(connected);
      } catch (error) {
        if (mounted) {
          setEsp32Connected(false);
        }
      }
    }

    fetchDeviceStatus();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     SOCKET.IO DEVICE STATUS
  ========================================================= */

  useEffect(() => {
    if (!socket) return;

    function handleDeviceStatus(payload) {
      if (!payload) return;

      const payloadDeviceId =
        payload.deviceId ||
        payload.id ||
        payload.device?.deviceId;

      if (
        payloadDeviceId &&
        payloadDeviceId !== DEVICE_ID
      ) {
        return;
      }

      const status = String(
        payload.status ||
          payload.deviceStatus ||
          payload.connectionStatus ||
          ""
      ).toLowerCase();

      const connected =
        payload.connected === true ||
        payload.online === true ||
        status === "online" ||
        status === "connected";

      setEsp32Connected(connected);
    }

    function handleTelemetryUpdate(payload) {
      if (!payload) return;

      const payloadDeviceId =
        payload.deviceId ||
        payload.device?.deviceId;

      if (
        payloadDeviceId &&
        payloadDeviceId !== DEVICE_ID
      ) {
        return;
      }

      // Valid telemetry means ESP32 is communicating.
      setEsp32Connected(true);
    }

    socket.on(
      "device:status",
      handleDeviceStatus
    );

    socket.on(
      "telemetry:update",
      handleTelemetryUpdate
    );

    socket.on(
      "device:telemetry",
      handleTelemetryUpdate
    );

    return () => {
      socket.off(
        "device:status",
        handleDeviceStatus
      );

      socket.off(
        "telemetry:update",
        handleTelemetryUpdate
      );

      socket.off(
        "device:telemetry",
        handleTelemetryUpdate
      );
    };
  }, [socket]);

  /* =========================================================
     LOGOUT
  ========================================================= */

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  /* =========================================================
     MOBILE SIDEBAR
  ========================================================= */

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  /* =========================================================
     PROFILE
  ========================================================= */

  function openProfile() {
    navigate("/profile");
  }

  return (
    <div
      className={`dashboard-layout ${
        collapsed ? "sidebar-collapsed" : ""
      }`}
    >
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobileSidebar}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`dashboard-sidebar ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        {/* ===================================================
            BRAND
        =================================================== */}

        <div className="sidebar-brand">
          <div className="brand-logo">
            <ShieldCheck
              size={25}
              strokeWidth={2.2}
            />
          </div>

          {!collapsed && (
            <div className="brand-content">
              <span className="brand-name">
                SafeHaven
              </span>

              <span className="brand-subtitle">
                Smart Safety System
              </span>
            </div>
          )}

          <button
            className="mobile-close-button"
            onClick={closeMobileSidebar}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* ===================================================
            NAVIGATION
        =================================================== */}

        <nav className="sidebar-navigation">
          <div className="navigation-section-title">
            {!collapsed && "MAIN MENU"}
          </div>

          <div className="navigation-list">
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={closeMobileSidebar}
                  className={({ isActive }) =>
                    `navigation-item ${
                      isActive ? "active" : ""
                    }`
                  }
                >
                  <span className="navigation-icon">
                    <Icon
                      size={19}
                      strokeWidth={2}
                    />
                  </span>

                  {!collapsed && (
                    <span className="navigation-label">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* ===================================================
            SIDEBAR BOTTOM
        =================================================== */}

        <div className="sidebar-bottom">
          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <LogOut size={18} />

            {!collapsed && (
              <span>Logout</span>
            )}
          </button>
        </div>

        {/* ===================================================
            COLLAPSE BUTTON
        =================================================== */}

        <button
          className="sidebar-collapse-button"
          onClick={() =>
            setCollapsed(
              (value) => !value
            )
          }
          aria-label={
            collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {collapsed ? (
            <ChevronRight size={17} />
          ) : (
            <ChevronLeft size={17} />
          )}
        </button>
      </aside>

      {/* =====================================================
          MAIN APPLICATION AREA
      ===================================================== */}

      <div className="dashboard-main-area">
        {/* ===================================================
            TOP HEADER
        =================================================== */}

        <header className="dashboard-header">
          <div className="header-left">
            <button
              className="mobile-menu-button"
              onClick={() =>
                setMobileOpen(true)
              }
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="header-page-info">
              <span className="header-system-label">
                SAFEHAVEN
              </span>

              <span className="header-divider">
                /
              </span>

              <span className="header-current-label">
                Safety Monitoring Platform
              </span>
            </div>
          </div>

          {/* =================================================
              HEADER RIGHT
          ================================================= */}

          <div className="header-right">
            {/* ESP32 DEVICE STATUS */}

            <div
              className={`header-device-status ${
                esp32Connected
                  ? "connected"
                  : "disconnected"
              }`}
            >
              <span className="header-device-dot" />

              <span className="header-device-name">
                ESP32_Unit
              </span>

              <span className="header-device-state">
                {esp32Connected
                  ? "Connected"
                  : "Disconnected"}
              </span>
            </div>

            {/* NOTIFICATIONS */}

            <button
              className="header-notification-button"
              onClick={() =>
                navigate("/alerts")
              }
              aria-label="View alerts"
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            {/* USER PROFILE */}

            <button
              type="button"
              className="header-user header-user-button"
              onClick={openProfile}
              aria-label="Open profile"
            >
              <div className="header-user-avatar">
                {user?.name
                  ? user.name
                      .charAt(0)
                      .toUpperCase()
                  : "A"}
              </div>

              <div className="header-user-info">
                <span className="header-user-name">
                  {user?.name ||
                    "SafeHaven Admin"}
                </span>

                <span className="header-user-role">
                  {user?.role || "ADMIN"}
                </span>
              </div>
            </button>
          </div>
        </header>

        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;