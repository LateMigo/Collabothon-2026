// Thin REST client for the FastAPI backend.
const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Can't reach the game server. Is the backend running on ${BASE_URL}?`,
      0,
      "network_error",
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join("; ")
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, data?.code);
  }
  return data;
}

export const api = {
  health: () => request("/health"),
  scenario: () => request("/scenario"),
  createSession: (payload) => request("/sessions", { method: "POST", body: payload }),
  getSession: (sessionId) => request(`/sessions/${sessionId}`),
  trade: (sessionId, payload) => request(`/sessions/${sessionId}/trade`, { method: "POST", body: payload }),
  savings: (sessionId, payload) => request(`/sessions/${sessionId}/savings`, { method: "POST", body: payload }),
  askAdvisor: (sessionId) => request(`/sessions/${sessionId}/advisor`, { method: "POST" }),
  nextWeek: (sessionId) => request(`/sessions/${sessionId}/next-week`, { method: "POST" }),
  finalAnalysis: (sessionId) => request(`/sessions/${sessionId}/final-analysis`),
};
