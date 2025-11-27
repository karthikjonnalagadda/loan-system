// src/pages/OAuthCallback.js
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function OAuthCallback() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);

    // Accept multiple possible param names to be robust
    const token = q.get("token") || q.get("access_token") || q.get("t");
    const role = q.get("role") || q.get("r") || "user";

    console.debug("OAuthCallback - querystring:", window.location.search);
    console.debug("OAuthCallback - parsed token:", !!token, " role:", role);

    if (token) {
      // setAuth expects (token, role, userObj)
      try {
        setAuth(token, role, null);
        // remove token from URL to avoid leaking in history
        const cleanUrl = window.location.origin + "/oauth_callback";
        window.history.replaceState({}, document.title, cleanUrl);
        // navigate to role-specific dashboard
        if (role === "admin") nav("/admin");
        else nav("/user");
      } catch (err) {
        console.error("OAuthCallback - setAuth failed", err);
        nav("/login");
      }
    } else {
      console.warn("OAuthCallback - no token found in URL");
      nav("/login");
    }
  }, [nav, setAuth]);

  return (
    <div style={{ padding: 24 }}>
      <h3>Signing you in...</h3>
      <p>If you are not redirected automatically, <a href="/login">go to login</a>.</p>
    </div>
  );
}
