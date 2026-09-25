import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../styles/login.css";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);

      navigate("/dashboard", {
        replace: true,
      });
    } catch (loginError) {
      setError(
        loginError.message ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-background-grid" />

      <section className="login-card">
        {/* Brand */}

        <div className="login-brand">
          <div className="login-brand-icon">
            <ShieldCheck size={27} strokeWidth={2.2} />
          </div>

          <div className="login-brand-text">
            <h1>SafeHaven</h1>
            <span>IoT Safety Platform</span>
          </div>
        </div>

        {/* Header */}

        <div className="login-header">
          <h2>Welcome back</h2>

          <p>
            Sign in to continue to your safety dashboard.
          </p>
        </div>

        {/* Form */}

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          {error && (
            <div
              className="login-error"
              role="alert"
            >
              <span className="login-error-icon">
                !
              </span>

              <span>{error}</span>
            </div>
          )}

          {/* Email */}

          <div className="login-field">
            <label htmlFor="email">
              Email address
            </label>

            <div className="login-input-wrapper">
              <Mail
                size={18}
                strokeWidth={2}
              />

              <input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          {/* Password */}

          <div className="login-field">
            <div className="login-label-row">
              <label htmlFor="password">
                Password
              </label>
            </div>

            <div className="login-input-wrapper">
              <LockKeyhole
                size={18}
                strokeWidth={2}
              />

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                disabled={isSubmitting}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                disabled={isSubmitting}
              >
                {showPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>
          </div>

          {/* Options */}

          <div className="login-options">
            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(
                    event.target.checked
                  )
                }
                disabled={isSubmitting}
              />

              <span>Remember me</span>
            </label>

            <button
              type="button"
              className="forgot-password"
              onClick={() =>
                alert(
                  "Password recovery will be connected in a later phase."
                )
              }
              disabled={isSubmitting}
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}

          <button
            type="submit"
            className="login-submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="login-spinner" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Security */}

        <div className="login-security">
          <LockKeyhole size={14} />

          <span>
            Secure connection · Protected authentication
          </span>
        </div>

        {/* Footer */}

        <div className="login-footer">
          <span>SafeHaven IoT Safety Platform</span>
          <span>v1.0.0</span>
        </div>
      </section>
    </main>
  );
}

export default Login;