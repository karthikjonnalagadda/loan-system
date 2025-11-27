// src/api/index.js
// Unified API Helper for the Loan System Frontend

const BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

/* ----------------------- URL Builder ----------------------- */
function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ----------------------- Core Fetch Wrapper ----------------------- */
export async function apiFetch(
  path,
  {
    method = "GET",
    body = null,
    token = null,
    headers = {},
    timeoutMs = 10000,
  } = {}
) {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const opts = {
    method,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (token) {
    opts.headers["Authorization"] = `Bearer ${token}`;
  }

  if (body && method !== "GET" && method !== "HEAD") {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    clearTimeout(timeout);

    const raw = await res.text();
    let data = raw;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      const err = new Error(
        data?.message || data?.error || data?.msg || res.statusText
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      const timeoutErr = new Error("Request timed out");
      timeoutErr.code = "ETIMEDOUT";
      throw timeoutErr;
    }
    throw err;
  }
}

/* ----------------------- Helper Functions ----------------------- */
export const predictRisk = (payload, token) =>
  apiFetch("/api/predict", { method: "POST", body: payload, token });

export const submitLoanApplication = (payload, token) =>
  apiFetch("/api/loan/applications", { method: "POST", body: payload, token });

/* ----------------------- Default Export ----------------------- */
const api = {
  apiFetch,
  predictRisk,
  submitLoanApplication,
};

export default api;
