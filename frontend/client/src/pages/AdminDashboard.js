import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";
import "./AdminDashboard.css";

function Badge({ children, type = "default" }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}

function ConfirmButton({ onConfirm, children, className = "" }) {
  async function handleClick() {
    const ok = window.confirm("Are you sure you want to proceed?");
    if (!ok) return;
    await onConfirm();
  }
  return (
    <button className={`btn small ${className}`} onClick={handleClick}>
      {children}
    </button>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const token = user?.token;

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // selected app for modal
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    let mounted = true;
    (async function load() {
      setLoading(true);
      try {
        // original used /api/admin/loan/applications — keep that path
        const res = await apiFetch("/api/admin/loan/applications", { method: "GET", token });
        if (mounted) setApps(Array.isArray(res) ? res : []);
      } catch (err) {
        alert("Failed to load applications");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  async function decide(id, status) {
    try {
      await apiFetch(`/api/admin/loan/applications/${id}/decision`, { method: "PATCH", body: { status }, token });
      // optimistic refresh: update local state quickly
      setApps(prev => prev.map(a => (a.id === id ? { ...a, decision_status: status } : a)));
    } catch (err) {
      alert("Failed to update status");
    }
  }

  // derived: filtered + sorted
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = apps.filter(a => {
      if (statusFilter !== "ALL" && (a.decision_status || "").toUpperCase() !== statusFilter) return false;
      if (!q) return true;
      // search across name, purpose, id
      return (
        String(a.full_name || "").toLowerCase().includes(q) ||
        String(a.loan_purpose || "").toLowerCase().includes(q) ||
        String(a.id || "").toLowerCase().includes(q)
      );
    });

    out.sort((x, y) => {
      const a = x[sortKey];
      const b = y[sortKey];
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      // numeric date handling
      if (sortKey === "created_at") {
        return sortDir === "asc"
          ? new Date(a) - new Date(b)
          : new Date(b) - new Date(a);
      }
      if (!isNaN(Number(a)) && !isNaN(Number(b))) {
        return sortDir === "asc" ? Number(a) - Number(b) : Number(b) - Number(a);
      }
      const sa = String(a).toLowerCase();
      const sb = String(b).toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });

    return out;
  }, [apps, query, statusFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  function openDetails(app) {
    setSelected(app);
  }
  function closeDetails() {
    setSelected(null);
  }

  return (
    <div className="adm-page">
      <div className="adm-header">
        <h1>Admin Dashboard</h1>
        <div className="adm-controls">
          <div className="stats">
            <div className="stat">
              <div className="stat-title">Total Apps</div>
              <div className="stat-value">{apps.length}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Pending</div>
              <div className="stat-value">{apps.filter(a => (a.decision_status || "").toUpperCase() === "PENDING").length}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Approved</div>
              <div className="stat-value">{apps.filter(a => (a.decision_status || "").toUpperCase() === "APPROVED").length}</div>
            </div>
          </div>
        </div>
      </div>

      <section className="adm-filters card">
        <div className="filter-left">
          <input
            className="search"
            placeholder="Search by name, purpose or id..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          />

          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="created_at">Date</option>
            <option value="monthly_income">Income</option>
            <option value="loan_amount">Loan Amount</option>
            <option value="ml_score">ML Score</option>
          </select>

          <button
            className="btn small"
            onClick={() => setSortDir(prev => (prev === "asc" ? "desc" : "asc"))}
            title="Toggle sort direction"
          >
            Sort: {sortDir.toUpperCase()}
          </button>
        </div>

        <div className="filter-right">
          <button className="btn" onClick={async () => {
            setLoading(true);
            try {
              const res = await apiFetch("/api/admin/loan/applications", { method: "GET", token });
              setApps(Array.isArray(res) ? res : []);
            } catch {
              alert("Failed to refresh");
            } finally {
              setLoading(false);
            }
          }}>
            Refresh
          </button>
        </div>
      </section>

      <div className="table-wrap card">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{width: "26%"}}>Applicant</th>
                <th>Income</th>
                <th>Loan</th>
                <th>ML Score</th>
                <th>Label</th>
                <th>Status</th>
                <th style={{width: "18%"}}>Actions</th>
                <th style={{width: "13%"}}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="8" className="empty">No applications found.</td></tr>
              )}
              {rows.map(app => (
                <tr key={app.id} className="row-hover">
                  <td className="applicant">
                    <div className="name">{app.full_name || "—"}</div>
                    <div className="sub">{app.loan_purpose || "—"}</div>
                    <div className="sub id">ID: {app.id}</div>
                  </td>
                  <td>₹{Number(app.monthly_income || 0).toLocaleString()}</td>
                  <td>₹{Number(app.loan_amount || 0).toLocaleString()}</td>
                  <td>
                    {app.ml_score != null ? (
                      <Badge type={app.ml_score >= 0.7 ? "danger" : app.ml_score >= 0.4 ? "warning" : "success"}>
                        {Number(app.ml_score).toFixed(3)}
                      </Badge>
                    ) : <Badge type="muted">—</Badge>}
                  </td>
                  <td>{app.ml_label || "—"}</td>
                  <td>
                    <Badge type={
                      (app.decision_status || "").toUpperCase() === "APPROVED" ? "success"
                      : (app.decision_status || "").toUpperCase() === "REJECTED" ? "danger"
                      : "warning"
                    }>
                      {app.decision_status || "PENDING"}
                    </Badge>
                  </td>
                  <td className="actions">
                    <button className="btn small" onClick={() => openDetails(app)}>Details</button>
                    <ConfirmButton onConfirm={() => decide(app.id, "APPROVED")} className="success small">Approve</ConfirmButton>
                    <ConfirmButton onConfirm={() => decide(app.id, "REJECTED")} className="danger small">Reject</ConfirmButton>
                  </td>
                  <td className="muted">{app.created_at ? new Date(app.created_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="pager">
        <div className="pager-left">
          <small>Showing {(filtered.length === 0) ? 0 : ( (page-1)*perPage + 1 )} - {Math.min(page*perPage, filtered.length)} of {filtered.length}</small>
        </div>
        <div className="pager-right">
          <button className="btn small" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
          <span className="page-num">Page {page} / {totalPages}</span>
          <button className="btn small" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>Next</button>
        </div>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={closeDetails}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Application: {selected.full_name}</h3>
              <button className="btn small" onClick={closeDetails}>Close</button>
            </div>
            <div className="modal-body">
              <table className="detail-table">
                <tbody>
                  {Object.entries(selected).map(([k,v]) => (
                    <tr key={k}>
                      <td className="k">{k}</td>
                      <td className="v">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-foot">
              <ConfirmButton onConfirm={() => decide(selected.id, "APPROVED")} className="success">Approve</ConfirmButton>
              <ConfirmButton onConfirm={() => decide(selected.id, "REJECTED")} className="danger">Reject</ConfirmButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
