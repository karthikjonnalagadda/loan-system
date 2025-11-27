import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth/AuthContext";

export default function Register() {
  const nav = useNavigate();
  const { setAuth } = useAuth();

  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function submit(e) {
    e.preventDefault();

    try {
      const res = await apiFetch("/api/auth/register", "POST", form);
      setAuth(res.access_token, res.role, res.user);

      if (res.role === "admin") nav("/admin");
      else nav("/user");
    } catch (err) {
      alert(err?.body?.msg || "Register failed");
    }
  }

  return (
    <div className="page">
      <h2>Register</h2>
      <form className="form" onSubmit={submit}>
        <input placeholder="Full Name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <button>Create Account</button>
      </form>
    </div>
  );
}
