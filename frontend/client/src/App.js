import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import OAuthCallback from "./pages/OAuthCallback";
import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import MyApplications from "./pages/MyApplications";
import AdminDashboard from "./pages/AdminDashboard";

/**
 * Small top nav that shows when user is logged in.
 */
function TopNav() {
  const { user, logout } = useAuth();

  // Support both shapes: user.role or user.user.role
  const role = user?.role || user?.user?.role;
  const name = user?.user?.name || user?.user?.email || "You";

  if (!user) return null;

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 16px",
      background: "#fff",
      borderBottom: "1px solid #eee",
      marginBottom: 18
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <strong style={{ color: "#0077ff" }}>LoanApp</strong>
        {role === "admin" ? <Link to="/admin">Admin</Link> : <Link to="/user">Dashboard</Link>}
        {role === "user" && <Link to="/user/applications">My Applications</Link>}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 14, color: "#333" }}>{name}</span>
        <button onClick={() => logout()} style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "none",
          background: "#e74c3c",
          color: "white",
          cursor: "pointer"
        }}>Logout</button>
      </div>
    </div>
  );
}

/**
 * ProtectedRoute: checks auth and allowedRoles.
 * Works even if AuthContext stores user as { token, role, user } or { token, role, userObj }.
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // derive role robustly
  const role = user?.role || user?.user?.role || null;

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <TopNav />
        <Routes>
          {/* If logged-in, redirect root to dashboard; otherwise show login */}
          <Route
            path="/"
            element={<HomeRedirect />}
          />

          <Route path="/oauth_callback" element={<OAuthCallback />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/user"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/user/applications"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <MyApplications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

/**
 * Component used for root redirect logic.
 * Sends logged-in users to appropriate dashboard based on role.
 */
function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const role = user?.role || user?.user?.role || null;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/user" replace />;
}
