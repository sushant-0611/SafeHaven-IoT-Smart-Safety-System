import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import LiveMonitoring from "./pages/LiveMonitoring";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import ControlCenter from "./pages/ControlCenter";
import Alerts from "./pages/Alerts";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";

import {
  AuthProvider,
} from "./context/AuthContext";

import {
  SocketProvider,
} from "./context/SocketContext";

import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";

function PlaceholderPage({ title }) {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 120px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "var(--color-background)",
        fontFamily:
          "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background:
            "var(--color-surface)",
          padding: "40px",
          borderRadius:
            "var(--radius-lg)",
          border:
            "1px solid var(--color-border)",
          boxShadow:
            "var(--shadow-sm)",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            margin: "0 0 10px",
            color: "var(--color-text)",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: 0,
            color:
              "var(--color-text-muted)",
          }}
        >
          This SafeHaven module is
          under development.
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* =================================================
              PUBLIC
          ================================================= */}

          <Route
            path="/login"
            element={<Login />}
          />

          {/* =================================================
              PROTECTED APPLICATION
          ================================================= */}

          <Route
            element={<ProtectedRoute />}
          >
            <Route
              element={
                <SocketProvider>
                  <DashboardLayout />
                </SocketProvider>
              }
            >
              {/* Dashboard */}

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              {/* Live Monitoring */}

              <Route
                path="/live-monitoring"
                element={
                  <LiveMonitoring />
                }
              />

              {/* History */}

              <Route
                path="/history"
                element={<History />}
              />

              {/* Analytics */}

              <Route
                path="/analytics"
                element={<Analytics />}
              />

              {/* Control Center */}

              <Route
                path="/control"
                element={
                  <ControlCenter />
                }
              />

              {/* Alerts */}

              <Route
                path="/alerts"
                element={<Alerts />}
              />

              {/* Settings */}

              <Route
                path="/settings"
                element={<Settings />}
              />

              {/* Profile */}

              <Route
                path="/profile"
                element={<Profile />}
              />

              {/* Unknown protected route */}

              <Route
                path="*"
                element={
                  <PlaceholderPage
                    title="Page Not Found"
                  />
                }
              />
            </Route>
          </Route>

          {/* =================================================
              ROOT
          ================================================= */}

          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;