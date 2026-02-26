import api from "./axios";

// ✅ Helper: YYYY-MM-DD (local, sin librerías)
function toYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ✅ Helper: rango por "days" (incluye hoy)
function makeRange(days = 7) {
  const end = new Date(); // hoy
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  return { date_from: toYMD(start), date_to: toYMD(end) };
}

export const DashboardAPI = {
// ✅ Métricas
metrics: async (days = 7) => {
  const { data } = await api.get("/dashboard/metrics", {
    params: { days },
  });
  return data;
},

  // ✅ Próximas citas (esto está OK)
  upcoming: async (days = 7, limit = 20) => {
    const { data } = await api.get("/dashboard/upcoming", {
      params: { days, limit },
    });
    return data;
  },

  // ✅ Citas por día (AHORA sí respeta el rango)
  byDay: async (days = 14) => {
    const { date_from, date_to } = makeRange(days);
    const { data } = await api.get("/dashboard/appointments-by-day", {
      params: { date_from, date_to },
    });
    return data;
  },

  // ✅ Alias para no romper imports/código viejo
  appointmentsByDay: async (days = 14) => {
    const { date_from, date_to } = makeRange(days);
    const { data } = await api.get("/dashboard/appointments-by-day", {
      params: { date_from, date_to },
    });
    return data;
  },
};