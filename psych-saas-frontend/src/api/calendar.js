const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  "http://localhost:8000";

function getToken() {
  // Ajusta si tu app guarda con otro key:
  return localStorage.getItem("token") || localStorage.getItem("access_token") || "";
}

async function httpGet(path) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!res.ok) {
    let detail = "Request failed";
    try {
      const data = await res.json();
      detail = data?.detail || detail;
    } catch {}
    throw new Error(detail);
  }

  return res.json();
}

export const CalendarAPI = {
  async events(from, to) {
    const qs = new URLSearchParams({ from_date: from, to_date: to }).toString();
    return httpGet(`/calendar/events?${qs}`);
  },

  async daySlots(date) {
    const qs = new URLSearchParams({ date_str: date }).toString();
    return httpGet(`/calendar/day-slots?${qs}`);
  },
};