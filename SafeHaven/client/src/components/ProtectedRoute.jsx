import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function ProtectedRoute() {
  const {
    isAuthenticated,
    loading,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fb",
          fontFamily:
            "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "#475569",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              border: "4px solid #e2e8f0",
              borderTopColor: "#2563eb",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation:
                "safehaven-spin 0.8s linear infinite",
            }}
          />

          <p
            style={{
              margin: 0,
              fontSize: "14px",
            }}
          >
            Checking authentication...
          </p>

          <style>
            {`
              @keyframes safehaven-spin {
                from {
                  transform: rotate(0deg);
                }

                to {
                  transform: rotate(360deg);
                }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
