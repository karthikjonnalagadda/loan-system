import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import "./Login.css";

export default function Login() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      // note: backend path may be /api/auth/login depending on your server
      const res = await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });

      // save auth in context
      setAuth(res.access_token, res.role, res.user);

      // optionally persist token for "remember me"
      if (remember && res.access_token) {
        try {
          localStorage.setItem("access_token", res.access_token);
          localStorage.setItem("user_role", res.role || "");
        } catch (err) {
          // localStorage failures shouldn't block login
          console.warn("Failed to persist token:", err);
        }
      }

      // navigate
      if (res.role === "admin") nav("/admin");
      else nav("/user");
    } catch (err) {
      console.error("Login error:", err);
      const msg = err?.body?.msg || err?.message || "Login failed — please check credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/google/url", { method: "GET" });
      // redirect page to Google consent screen via backend URL
      window.location.href = res.url;
    } catch (err) {
      console.error("Google OAuth error:", err);
      setError("Could not start Google OAuth. Try again later.");
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <header className="login-head">
          <h1>Sign in</h1>
          <p className="subtitle">Welcome back — sign in to manage your applications.</p>
        </header>

        <form className="login-form" onSubmit={submit} aria-describedby="login-error">
          {error && <div id="login-error" role="alert" className="error">{error}</div>}

          <label className="field">
            <div className="label">Email</div>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </label>

          <label className="field">
            <div className="label">Password</div>
            <div className="pwd-row">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd(s => !s)}
                aria-pressed={showPwd}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="row between">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me</span>
            </label>

            <Link to="/forgot" className="small-link">Forgot password?</Link>
          </div>

          <button className="btn primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="divider"><span>OR</span></div>

          <button
            type="button"
            className="btn oauth"
            onClick={loginWithGoogle}
            disabled={loading}
            aria-label="Sign in with Google"
          >
            <svg className="google-icon" viewBox="0 0 533.5 544.3" aria-hidden width="18" height="18">
              <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272v95.4h146.9c-6.3 34-25.4 62.8-54.2 82v68.2h87.6c51.2-47.1 80.2-116.8 80.2-195.2z"/>
              <path fill="#34a853" d="M272 544.3c73.6 0 135.6-24.4 180.8-66.3l-87.6-68.2c-24.4 16.4-55.6 26-93.2 26-71.7 0-132.6-48.4-154.5-113.6H27.9v71.4C73.1 488.9 165.6 544.3 272 544.3z"/>
              <path fill="#fbbc04" d="M117.5 328.9c-10.9-32.6-10.9-67.9 0-100.5V157h-89.6C6.6 209.9 0 238.7 0 272s6.6 62.1 27.9 115.1l89.6-58.2z"/>
              <path fill="#ea4335" d="M272 107.7c39.8 0 75.4 13.7 103.5 40.6l77.6-77.6C407.2 24.2 349.1 0 272 0 165.6 0 73.1 55.4 27.9 146.9l89.6 71.4C139.4 156.1 200.3 107.7 272 107.7z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="foot">
            <span>Don’t have an account?</span>
            <Link to="/register" className="signup">Create account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
