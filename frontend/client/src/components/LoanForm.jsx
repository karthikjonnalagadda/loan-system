// frontend/client/src/components/LoanForm.jsx
import React, { useState } from "react";
import { predictRisk, submitLoanApplication } from "../api";

const employmentOptions = [
  "Salaried",
  "Self-Employed",
  "Unemployed",
  "Contract",
  "Other",
];

const maritalOptions = ["Single", "Married", "Divorced", "Widowed", "Other"];
const genderOptions = ["Male", "Female", "Other", "Prefer not to say"];

function interpretRisk(prob) {
  if (prob >= 0.7) return { level: "High", color: "#ff4d4f", msg: "High default risk — manual review recommended" };
  if (prob >= 0.4) return { level: "Medium", color: "#faad14", msg: "Medium risk — consider conditions or extra collateral" };
  return { level: "Low", color: "#52c41a", msg: "Low risk — likely approved" };
}

export default function LoanForm() {
  const [form, setForm] = useState({
    name: "",
    Age: "",
    Income: "",
    LoanAmount: "",
    CreditScore: "",
    EmploymentType: "",
    MaritalStatus: "",
    location: "",
    gender: "",
  });

  const [loading, setLoading] = useState(false);
  const [risk, setRisk] = useState(null);
  const [message, setMessage] = useState("");
  const [savedResp, setSavedResp] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  function buildPredictPayload() {
    return {
      Age: form.Age ? Number(form.Age) : undefined,
      Income: form.Income ? Number(form.Income) : undefined,
      LoanAmount: form.LoanAmount ? Number(form.LoanAmount) : undefined,
      CreditScore: form.CreditScore ? Number(form.CreditScore) : undefined,
      EmploymentType: form.EmploymentType || undefined,
      MaritalStatus: form.MaritalStatus || undefined,
      location: form.location || undefined,
      gender: form.gender || undefined,
      // you may optionally include loan_to_income if you compute it client-side:
      // loan_to_income: (form.LoanAmount && form.Income) ? Number(form.LoanAmount)/Number(form.Income) : undefined
    };
  }

  async function handlePredict(e) {
    e && e.preventDefault();
    setLoading(true);
    setRisk(null);
    setMessage("");
    setSavedResp(null);

    try {
      const payload = buildPredictPayload();
      const res = await predictRisk(payload);
      setRisk(res);
      setMessage(interpretRisk(res.default_probability).msg);
    } catch (err) {
      console.error(err);
      setMessage("Error predicting risk: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitAndSave(e) {
    e && e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      // ensure we have an ML prediction
      let res = risk;
      if (!res) {
        res = await predictRisk(buildPredictPayload());
        setRisk(res);
      }

      const appPayload = {
        applicant_name: form.name,
        age: form.Age ? Number(form.Age) : null,
        income: form.Income ? Number(form.Income) : null,
        loan_amount: form.LoanAmount ? Number(form.LoanAmount) : null,
        credit_score: form.CreditScore ? Number(form.CreditScore) : null,
        employment_type: form.EmploymentType,
        marital_status: form.MaritalStatus,
        location: form.location,
        gender: form.gender,
        ml_label: res ? res.predicted_label : null,
        ml_probability: res ? res.default_probability : null,
      };

      const saveRes = await submitLoanApplication(appPayload);
      setSavedResp(saveRes);
      setMessage("Application submitted successfully.");
    } catch (err) {
      console.error("Save error:", err);
      setMessage("Error saving application: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "1rem auto", padding: 20, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
      <h2>Loan Application & Risk Check</h2>

      <form onSubmit={handlePredict}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Name</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Full name" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Age</label>
            <input name="Age" value={form.Age} onChange={handleChange} placeholder="Age" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Income (annual)</label>
            <input name="Income" value={form.Income} onChange={handleChange} placeholder="Income" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Loan Amount</label>
            <input name="LoanAmount" value={form.LoanAmount} onChange={handleChange} placeholder="Loan amount" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Credit Score</label>
            <input name="CreditScore" value={form.CreditScore} onChange={handleChange} placeholder="Credit score" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Employment Type</label>
            <select name="EmploymentType" value={form.EmploymentType} onChange={handleChange} style={{ width: "100%" }}>
              <option value="">Select</option>
              {employmentOptions.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div>
            <label>Marital Status</label>
            <select name="MaritalStatus" value={form.MaritalStatus} onChange={handleChange} style={{ width: "100%" }}>
              <option value="">Select</option>
              {maritalOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label>Location</label>
            <input name="location" value={form.location} onChange={handleChange} placeholder="City / State" style={{ width: "100%" }} />
          </div>

          <div>
            <label>Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange} style={{ width: "100%" }}>
              <option value="">Select</option>
              {genderOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: "8px 14px" }}>
            {loading ? "Predicting..." : "Predict Risk"}
          </button>

          <button type="button" onClick={handleSubmitAndSave} disabled={loading} style={{ padding: "8px 14px" }}>
            {loading ? "Saving..." : "Submit & Save Application"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 12 }}>{message}</div>

      {risk && (
        <div style={{ marginTop: 18, padding: 12, borderRadius: 8, background: "#fafafa" }}>
          <h3>Risk Result</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 12, height: 12, borderRadius: 6,
              background: interpretRisk(risk.default_probability).color
            }} />
            <div>
              <div><strong>Default probability:</strong> {(risk.default_probability * 100).toFixed(2)}%</div>
              <div><strong>Risk label:</strong> {risk.predicted_label === 1 ? "High Risk" : "Low Risk"}</div>
              <div style={{ marginTop: 6 }}>{interpretRisk(risk.default_probability).msg}</div>
            </div>
          </div>
        </div>
      )}

      {savedResp && (
        <div style={{ marginTop: 12, background: "#f6ffed", padding: 10 }}>
          <strong>Saved:</strong> {JSON.stringify(savedResp)}
        </div>
      )}
    </div>
  );
}
