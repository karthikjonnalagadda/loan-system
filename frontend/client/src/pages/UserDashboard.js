// src/pages/UserDashboard.js
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";

/* ---------- constants ---------- */
const EMPLOYMENT_OPTIONS = [
  "Salaried",
  "Self-Employed",
  "Business Owner",
  "Freelancer",
  "Contract Worker",
  "Student",
  "Unemployed",
  "Retired",
];

const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Other"];
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

/* ---------- small UI helpers ---------- */
function Spinner() {
  return (
    <div style={spinnerOverlayStyle}>
      <div style={spinnerStyle} aria-label="Loading" />
    </div>
  );
}

function Toast({ id, type = "info", text, onClose }) {
  const bg = type === "error" ? "#ffecec" : type === "success" ? "#e6ffed" : "#f0f7ff";
  const border = type === "error" ? "#ffbdbd" : type === "success" ? "#8ee08e" : "#b6d4ff";
  useEffect(() => {
    const t = setTimeout(() => onClose && onClose(id), 4500);
    return () => clearTimeout(t);
  }, [id, onClose]);
  return (
    <div style={{ ...toastStyle, background: bg, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 14, color: "#111" }}>{text}</div>
      <button onClick={() => onClose && onClose(id)} style={toastCloseBtn}>
        ✕
      </button>
    </div>
  );
}

/* ---------- main component ---------- */
export default function UserDashboard() {
  const { user } = useAuth();
  const token = user?.token || user?.access_token || null;

  const [form, setForm] = useState({
    full_name: "",
    age: "",
    EmploymentType: "",
    monthly_income: "",
    Income: "",
    loan_amount: "",
    loan_purpose: "",
    existing_debts: "",
    credit_history_flag: false,
    CreditScore: "",
    MaritalStatus: "",
    location: "",
    gender: "",
  });

  const [loading, setLoading] = useState(false);
  const [mlResult, setMlResult] = useState(null);

  // UI messages
  const [message, setMessage] = useState(null); // inline box message {type,text}
  const [toasts, setToasts] = useState([]); // array of {id,type,text}

  // simple function to show a toast
  function showToast(text, type = "info") {
    const id = Date.now() + Math.random().toString(36).slice(2, 7);
    setToasts((t) => [...t, { id, text, type }]);
  }
  function removeToast(id) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  // helpers
  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function interpretRisk(prob) {
    if (prob >= 0.7) return { level: "High", color: "#ff4d4f", msg: "High default risk — manual review recommended" };
    if (prob >= 0.4) return { level: "Medium", color: "#faad14", msg: "Medium risk — consider conditions or extra collateral" };
    return { level: "Low", color: "#52c41a", msg: "Low risk — likely approved" };
  }

  /* ---------- validation ---------- */
  function validateForm(requiredOnly = false) {
    // returns { valid: bool, errors: { field: message } }
    const errors = {};
    // Required fields for a minimal application:
    const required = ["full_name", "age", "monthly_income", "loan_amount"];
    required.forEach((f) => {
      if (!form[f] && form[f] !== 0) errors[f] = "This field is required";
    });

    // numeric checks
    if (form.age && isNaN(Number(form.age))) errors.age = "Age must be a number";
    if (form.monthly_income && isNaN(Number(form.monthly_income))) errors.monthly_income = "Monthly income must be a number";
    if (form.loan_amount && isNaN(Number(form.loan_amount))) errors.loan_amount = "Loan amount must be a number";
    if (form.existing_debts && isNaN(Number(form.existing_debts))) errors.existing_debts = "Existing debts must be a number";
    if (form.CreditScore && isNaN(Number(form.CreditScore))) errors.CreditScore = "Credit score must be a number";

    const valid = Object.keys(errors).length === 0;
    return { valid, errors };
  }

  /* ---------- API calls ---------- */
  async function handlePredict(e) {
    e && e.preventDefault();
    setMessage(null);
    setMlResult(null);

    // validate minimal numeric fields (don't block predicting with partial info)
    const { valid } = validateForm(true); // we still check numeric types
    if (!valid) {
      showToast("Please fix form errors before predicting (check numeric fields).", "error");
      setMessage({ type: "error", text: "Validation errors — check form fields." });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        Age: form.age ? Number(form.age) : undefined,
        Income: form.Income ? Number(form.Income) : (form.monthly_income ? Number(form.monthly_income) * 12 : undefined),
        LoanAmount: form.loan_amount ? Number(form.loan_amount) : undefined,
        CreditScore: form.CreditScore ? Number(form.CreditScore) : undefined,
        EmploymentType: form.EmploymentType || undefined,
        MaritalStatus: form.MaritalStatus || undefined,
        location: form.location || undefined,
        gender: form.gender || undefined,
      };

      const res = await apiFetch("/api/predict", { method: "POST", body: payload, token });
      setMlResult(res);
      setMessage({ type: "info", text: interpretRisk(res.default_probability).msg });
      showToast("Prediction completed", "success");
    } catch (err) {
      console.error("Predict error:", err);
      const text = err?.data?.message || err?.message || "Prediction failed";
      setMessage({ type: "error", text });
      showToast(text, "error");
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMessage(null);

    // validate full form before submit
    const { valid, errors } = validateForm();
    if (!valid) {
      // show topmost error
      const firstKey = Object.keys(errors)[0];
      const firstMsg = errors[firstKey];
      setMessage({ type: "error", text: `${firstKey}: ${firstMsg}` });
      showToast("Fix validation errors before submitting", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: form.full_name,
        age: Number(form.age || 0),
        employment_type: form.EmploymentType,
        monthly_income: Number(form.monthly_income || 0),
        Income: form.Income ? Number(form.Income) : (form.monthly_income ? Number(form.monthly_income) * 12 : null),
        loan_amount: Number(form.loan_amount || 0),
        loan_purpose: form.loan_purpose,
        existing_debts: Number(form.existing_debts || 0),
        credit_history_flag: Boolean(form.credit_history_flag),
        credit_score: form.CreditScore ? Number(form.CreditScore) : null,
        marital_status: form.MaritalStatus || null,
        location: form.location || null,
        gender: form.gender || null,
      };

      // optionally run prediction before saving
      if (!mlResult) {
        try {
          const predictPayload = {
            Age: payload.age,
            Income: payload.Income,
            LoanAmount: payload.loan_amount,
            CreditScore: payload.credit_score,
            EmploymentType: payload.employment_type,
            MaritalStatus: payload.marital_status,
            location: payload.location,
            gender: payload.gender,
          };
          const ml = await apiFetch("/api/predict", { method: "POST", body: predictPayload, token });
          setMlResult(ml);
          payload.ml_label = ml.predicted_label;
          payload.ml_probability = ml.default_probability;
        } catch (pErr) {
          console.warn("Predict before save failed (continuing to save):", pErr);
          showToast("Prediction failed — saving without ML fields", "error");
          payload.ml_label = null;
          payload.ml_probability = null;
        }
      } else {
        payload.ml_label = mlResult.predicted_label;
        payload.ml_probability = mlResult.default_probability;
      }

      await apiFetch("/api/loan/applications", { method: "POST", body: payload, token });
      showToast("Application submitted", "success");
      setMessage({ type: "success", text: "Application submitted successfully!" });

      // reset
      setForm({
        full_name: "",
        age: "",
        EmploymentType: "",
        monthly_income: "",
        Income: "",
        loan_amount: "",
        loan_purpose: "",
        existing_debts: "",
        credit_history_flag: false,
        CreditScore: "",
        MaritalStatus: "",
        location: "",
        gender: "",
      });
      setMlResult(null);
    } catch (err) {
      console.error("Submit error:", err);
      const text = err?.data?.message || err?.message || "Submit failed";
      setMessage({ type: "error", text });
      showToast(text, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ fontFamily: "Inter, system-ui, sans-serif", padding: "20px 40px", background: "#f7f9fc", minHeight: "100vh" }}>
      {loading && <Spinner />}

      {/* toasts container */}
      <div style={toastsContainerStyle}>
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={removeToast} />
        ))}
      </div>

      <h2 style={{ textAlign: "center", marginBottom: 25, fontWeight: 600, color: "#222", fontSize: "32px" }}>User Dashboard</h2>

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        <form onSubmit={submit} style={{ flex: 1, background: "white", padding: 25, borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginBottom: 20, fontWeight: 600 }}>Loan Application</h3>

          {/* Full name */}
          <label className="label">Full Name</label>
          <input style={inputStyle} placeholder="Full Name" value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} />

          {/* Age */}
          <label className="label">Age</label>
          <input style={inputStyle} placeholder="Age" type="number" value={form.age} onChange={(e) => setField("age", e.target.value)} />

          {/* Employment and income */}
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Employment Type</label>
              <select style={inputStyle} value={form.EmploymentType} onChange={(e) => setField("EmploymentType", e.target.value)}>
                <option value="">-- Select employment type --</option>
                {EMPLOYMENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Monthly Income (₹)</label>
              <input style={inputStyle} placeholder="Monthly income" type="number" value={form.monthly_income} onChange={(e) => setField("monthly_income", e.target.value)} />
            </div>
          </div>

          <label className="label">Annual Income (optional)</label>
          <input style={inputStyle} placeholder="Annual Income" type="number" value={form.Income} onChange={(e) => setField("Income", e.target.value)} />

          <label className="label">Loan Amount (₹)</label>
          <input style={inputStyle} placeholder="Loan amount" type="number" value={form.loan_amount} onChange={(e) => setField("loan_amount", e.target.value)} />

          <label className="label">Credit Score</label>
          <input style={inputStyle} placeholder="Credit Score" type="number" value={form.CreditScore} onChange={(e) => setField("CreditScore", e.target.value)} />

          <label className="label">Marital Status</label>
          <select style={inputStyle} value={form.MaritalStatus} onChange={(e) => setField("MaritalStatus", e.target.value)}>
            <option value="">-- Select marital status --</option>
            {MARITAL_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <label className="label">Location</label>
          <input style={inputStyle} placeholder="Location" value={form.location} onChange={(e) => setField("location", e.target.value)} />

          <label className="label">Gender</label>
          <select style={inputStyle} value={form.gender} onChange={(e) => setField("gender", e.target.value)}>
            <option value="">-- Select gender --</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          <label className="label">Loan Purpose</label>
          <input style={inputStyle} placeholder="Loan purpose" value={form.loan_purpose} onChange={(e) => setField("loan_purpose", e.target.value)} />

          <label className="label">Existing Debts (₹)</label>
          <input style={inputStyle} placeholder="Existing debts" type="number" value={form.existing_debts} onChange={(e) => setField("existing_debts", e.target.value)} />

          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 10 }}>
            <input type="checkbox" checked={form.credit_history_flag} onChange={(e) => setField("credit_history_flag", e.target.checked)} />
            Credit history flag
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
            <button type="button" onClick={handlePredict} style={primaryBtn} disabled={loading}>
              {loading ? "Predicting..." : "Predict Risk"}
            </button>

            <button style={primaryBtn} type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Application"}
            </button>

            <Link to="/user/applications">
              <button type="button" style={secondaryBtn}>
                View My Applications
              </button>
            </Link>
          </div>

          {message && (
            <div style={{ marginTop: 15, padding: "12px 16px", borderRadius: 8, background: message.type === "error" ? "#ffe5e5" : "#e8ffe8", border: message.type === "error" ? "1px solid #ffbdbd" : "1px solid #b8e6b8", color: message.type === "error" ? "#a60000" : "#0d5e0d" }}>
              {message.text}
            </div>
          )}
        </form>

        {/* RIGHT COLUMN */}
        <div style={{ width: 320, background: "white", padding: 20, borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
          <h4 style={{ marginBottom: 10, fontWeight: 600 }}>Quick Tips</h4>
          <ul style={{ color: "#444", lineHeight: "1.6" }}>
            <li>Choose correct employment type.</li>
            <li>Monthly income must be accurate.</li>
            <li>Track status in “My Applications”.</li>
          </ul>

          <Link to="/user/applications">
            <button style={{ ...primaryBtn, marginTop: 10, width: "100%" }}>Go to My Applications</button>
          </Link>

          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 8 }}>Risk Analysis</h4>
            {mlResult ? (
              <div style={{ padding: 12, borderRadius: 8, background: "#fafafa" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 6, background: interpretRisk(mlResult.default_probability).color }} />
                  <div>
                    <div>
                      <strong>Default probability:</strong> {(mlResult.default_probability * 100).toFixed(2)}%
                    </div>
                    <div>
                      <strong>Risk label:</strong> {mlResult.predicted_label === 1 ? "High Risk" : "Low Risk"}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>{interpretRisk(mlResult.default_probability).msg}</div>
              </div>
            ) : (
              <div style={{ color: "#666", marginTop: 6 }}>No prediction yet. Click “Predict Risk”.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ccc",
  marginBottom: 12,
  fontSize: "15px",
};

const primaryBtn = {
  padding: "10px 18px",
  background: "#0066ff",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: "15px",
  fontWeight: 500,
};

const secondaryBtn = {
  padding: "10px 18px",
  background: "#f0f0f0",
  border: "1px solid #ccc",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: "15px",
};

const spinnerOverlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.15)",
  zIndex: 9999,
};

const spinnerStyle = {
  width: 56,
  height: 56,
  borderRadius: 999,
  border: "6px solid rgba(255,255,255,0.9)",
  borderTopColor: "#0066ff",
  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
  animation: "spin 1s linear infinite",
};

/* toast styles */
const toastsContainerStyle = {
  position: "fixed",
  right: 20,
  top: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  zIndex: 10000,
};
const toastStyle = {
  minWidth: 240,
  padding: "10px 12px",
  borderRadius: 8,
  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const toastCloseBtn = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 14,
};
