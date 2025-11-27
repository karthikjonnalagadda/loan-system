import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import "./MyApplications.css";

function Badge({ children, type = "default" }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

export default function MyApplications() {
  const { user } = useAuth();
  const token = user?.token || user?.access_token;
  const [apps, setApps] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await apiFetch("/api/loan/applications/my", { method: "GET", token });
        setApps(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Load apps failed:", err);
        alert("Failed to load applications");
      }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return apps;

    return apps.filter(a =>
      String(a.full_name || "").toLowerCase().includes(q) ||
      String(a.loan_purpose || "").toLowerCase().includes(q) ||
      String(a.decision_status || "").toLowerCase().includes(q)
    );
  }, [apps, query]);

  return (
    <div className="myapps-page">
      <div className="header">
        <h1>My Applications</h1>
      </div>

      <div className="filters card">
        <input
          className="search"
          placeholder="Search by name, purpose, or status..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="table-wrapper card">
        {filtered.length === 0 ? (
          <div className="empty-state">No applications found.</div>
        ) : (
          <table className="my-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Loan Amount</th>
                <th>ML Score</th>
                <th>Label</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(app => (
                <tr key={app.id}>
                  <td>
                    <div className="name">{app.full_name || "—"}</div>
                    <div className="sub">{app.loan_purpose || "—"}</div>
                  </td>

                  <td>₹{Number(app.loan_amount || 0).toLocaleString()}</td>

                  <td>
                    {app.ml_score != null ? (
                      <Badge
                        type={
                          app.ml_score >= 0.7
                            ? "danger"
                            : app.ml_score >= 0.4
                            ? "warning"
                            : "success"
                        }
                      >
                        {Number(app.ml_score).toFixed(3)}
                      </Badge>
                    ) : (
                      <Badge type="muted">—</Badge>
                    )}
                  </td>

                  <td>{app.ml_label || "—"}</td>

                  <td>
                    <Badge
                      type={
                        (app.decision_status || "").toUpperCase() === "APPROVED"
                          ? "success"
                          : (app.decision_status || "").toUpperCase() === "REJECTED"
                          ? "danger"
                          : "warning"
                      }
                    >
                      {app.decision_status || "PENDING"}
                    </Badge>
                  </td>

                  <td className="muted">
                    {app.created_at ? new Date(app.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
