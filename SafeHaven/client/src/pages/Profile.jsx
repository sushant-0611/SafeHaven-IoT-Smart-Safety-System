import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  User,
  UserRound,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import "../styles/profile.css";

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const displayName =
    user?.name || "SafeHaven Admin";

  const role =
    user?.role || "ADMIN";

  const username =
    user?.username ||
    user?.userName ||
    user?.email?.split("@")[0] ||
    "Not available";

  const email =
    user?.email || "Not available";

  const mobile =
    user?.mobile ||
    user?.phone ||
    user?.phoneNumber ||
    "Not available";

  const status =
    user?.status ||
    "Active";

  const createdAt =
    user?.createdAt ||
    user?.created_at ||
    null;

  const lastLogin =
    user?.lastLogin ||
    user?.last_login ||
    null;

  function formatDate(value) {
    if (!value) {
      return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  return (
    <div className="profile-page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="profile-page-header">
        <div className="profile-header-left">
          <button
            type="button"
            className="profile-back-button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            <ArrowLeft size={18} />
            <span>
              Back to Dashboard
            </span>
          </button>
        </div>
      </div>

      {/* =====================================================
          PROFILE CONTAINER
      ===================================================== */}

      <div className="profile-container">
        {/* ===================================================
            PROFILE HERO
        =================================================== */}

        <div className="profile-hero">
          <div className="profile-avatar-large">
            {displayName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="profile-hero-content">
            <h1>{displayName}</h1>

            <p>
              {role}
            </p>

            <div className="profile-active-status">
              <span className="profile-status-dot" />
              <span>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================
            ACCOUNT INFORMATION
        =================================================== */}

        <section className="profile-section">
          <div className="profile-section-title">
            <div className="profile-section-icon">
              <UserRound size={18} />
            </div>

            <div>
              <h2>
                Personal Information
              </h2>

              <p>
                Your registered account
                information
              </p>
            </div>
          </div>

          <div className="profile-details-grid">
            {/* Full Name */}

            <div className="profile-detail-card">
              <div className="profile-detail-icon">
                <User size={18} />
              </div>

              <div className="profile-detail-content">
                <span className="profile-detail-label">
                  Full Name
                </span>

                <strong>
                  {displayName}
                </strong>
              </div>
            </div>

            {/* Username */}

            <div className="profile-detail-card">
              <div className="profile-detail-icon">
                <CircleUserRound size={18} />
              </div>

              <div className="profile-detail-content">
                <span className="profile-detail-label">
                  Username
                </span>

                <strong>
                  {username}
                </strong>
              </div>
            </div>

            {/* Email */}

            <div className="profile-detail-card">
              <div className="profile-detail-icon">
                <Mail size={18} />
              </div>

              <div className="profile-detail-content">
                <span className="profile-detail-label">
                  Email Address
                </span>

                <strong>
                  {email}
                </strong>
              </div>
            </div>

            {/* Mobile */}

            <div className="profile-detail-card">
              <div className="profile-detail-icon">
                <Phone size={18} />
              </div>

              <div className="profile-detail-content">
                <span className="profile-detail-label">
                  Mobile Number
                </span>

                <strong>
                  {mobile}
                </strong>
              </div>
            </div>

            {/* Role */}

            <div className="profile-detail-card">
              <div className="profile-detail-icon">
                <ShieldCheck size={18} />
              </div>

              <div className="profile-detail-content">
                <span className="profile-detail-label">
                  Account Role
                </span>

                <strong>
                  {role}
                </strong>
              </div>
            </div>

            {/* Status */}

            <div className="profile-detail-card">
              <div className="profile-detail-icon">
                <CheckCircle2 size={18} />
              </div>

              <div className="profile-detail-content">
                <span className="profile-detail-label">
                  Account Status
                </span>

                <strong className="profile-status-text">
                  {status}
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================
            ACCOUNT DETAILS
        =================================================== */}

        <section className="profile-section">
          <div className="profile-section-title">
            <div className="profile-section-icon">
              <CalendarDays size={18} />
            </div>

            <div>
              <h2>
                Account Details
              </h2>

              <p>
                Account and platform
                information
              </p>
            </div>
          </div>

          <div className="profile-account-grid">
            <div className="profile-account-row">
              <span>
                Account Created
              </span>

              <strong>
                {formatDate(
                  createdAt
                )}
              </strong>
            </div>

            <div className="profile-account-row">
              <span>
                Last Login
              </span>

              <strong>
                {formatDate(
                  lastLogin
                )}
              </strong>
            </div>

            <div className="profile-account-row">
              <span>
                Connected Device
              </span>

              <strong>
                SAFEHAVEN-001
              </strong>
            </div>

            <div className="profile-account-row">
              <span>
                Device Type
              </span>

              <strong>
                ESP32 Safety Unit
              </strong>
            </div>
          </div>
        </section>

        {/* ===================================================
            SECURITY NOTE
        =================================================== */}

        <div className="profile-security-note">
          <ShieldCheck size={19} />

          <div>
            <strong>
              SafeHaven Account
            </strong>

            <p>
              Your account is protected
              and connected to the
              SafeHaven Smart Safety
              Monitoring Platform.
            </p>
          </div>
        </div>

        {/* ===================================================
            BOTTOM BACK BUTTON
        =================================================== */}

        <div className="profile-footer">
          <button
            type="button"
            className="profile-footer-back"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            <ArrowLeft size={17} />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;