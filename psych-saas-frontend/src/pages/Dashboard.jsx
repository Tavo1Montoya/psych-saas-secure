import { useEffect, useMemo, useState } from "react";
import { DashboardAPI } from "../api/dashboard";
import { useNavigate } from "react-router-dom";

function MetricCard({ title, value, hint, onClick }) {
  return (
    <div
      className="card cardPad"
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
      title={onClick ? "Click para ver detalles" : undefined}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 26, marginTop: 6, fontWeight: 900 }}>{value}</div>
      {hint && <div className="p">{hint}</div>}
    </div>
  );
}

function formatDT(val) {
  if (!val) return "-";
  try {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString();
  } catch {
    return String(val);
  }
}

function normalizeStatus(s) {
  const v = (s || "").toString().toLowerCase().trim();
  if (v === "no-show" || v === "noshow") return "no_show";
  return v;
}

function labelStatusEs(status) {
  const s = normalizeStatus(status);
  switch (s) {
    case "scheduled":
      return "Agendada";
    case "completed":
      return "Completada";
    case "cancelled":
      return "Cancelada";
    case "no_show":
      return "No asistió";
    default:
      return status || "—";
  }
}

function getPatientLabel(item) {
  if (item?.patient_name) return item.patient_name;
  if (item?.patient_full_name) return item.patient_full_name;
  if (item?.patient?.full_name) return item.patient.full_name;
  if (item?.patient?.name) return item.patient.name;
  if (item?.patient_id) return `Paciente #${item.patient_id}`;
  return "Paciente";
}

function StatusBadge({ status }) {
  const s = (status || "scheduled").toLowerCase();

  let bg = "rgba(255,255,255,.08)";
  let br = "rgba(255,255,255,.18)";
  let tx = "rgba(255,255,255,.85)";

  if (s === "scheduled") {
    bg = "rgba(80,160,255,.14)";
    br = "rgba(80,160,255,.28)";
  } else if (s === "cancelled") {
    bg = "rgba(255,90,122,.14)";
    br = "rgba(255,90,122,.28)";
  } else if (s === "completed") {
    bg = "rgba(80,220,160,.14)";
    br = "rgba(80,220,160,.28)";
  } else if (s === "no-show" || s === "noshow" || s === "no_show") {
    bg = "rgba(255,190,80,.14)";
    br = "rgba(255,190,80,.28)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        border: `1px solid ${br}`,
        color: tx,
      }}
      title={s}
    >
      {labelStatusEs(s)}
    </span>
  );
}

export default function Dashboard() {
  const [m, setM] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [byDay, setByDay] = useState([]);
  const [err, setErr] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [loadingByDay, setLoadingByDay] = useState(true);

  const [rangeDays, setRangeDays] = useState(7);
  const navigate = useNavigate();

  function goAppointments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    navigate(`/appointments${qs ? `?${qs}` : ""}`);
  }

  async function loadDashboard({ days } = { days: rangeDays }) {
    setErr("");
    setLoading(true);
    setLoadingUpcoming(true);
    setLoadingByDay(true);

    try {
      const [metricsRes, upcomingRes, byDayRes] = await Promise.all([
        DashboardAPI.metrics(days).catch((e) => ({ __err: e })),
        DashboardAPI.upcoming?.(days, 20).catch((e) => ({ __err: e })),
        (DashboardAPI.byDay ? DashboardAPI.byDay(days) : DashboardAPI.appointmentsByDay?.(days))?.catch((e) => ({
          __err: e,
        })),
      ]);

      if (metricsRes?.__err) {
        const e = metricsRes.__err;
        setErr(e?.response?.data?.detail || "No se pudo cargar métricas");
        setM(null);
      } else {
        setM(metricsRes);
      }

      if (upcomingRes?.__err) setUpcoming([]);
      else setUpcoming(Array.isArray(upcomingRes) ? upcomingRes : upcomingRes?.items || []);

      if (byDayRes?.__err) setByDay([]);
      else setByDay(Array.isArray(byDayRes) ? byDayRes : byDayRes?.items || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
      setLoadingUpcoming(false);
      setLoadingByDay(false);
    }
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      await loadDashboard({ days: rangeDays });
      if (!alive) return;
    })();

    return () => {
      alive = false;
    };
  }, [rangeDays]);

  const utilizationText = useMemo(() => {
    const v = m?.utilization_percent;
    if (v === 0) return "0%";
    if (v === null || v === undefined) return "-";
    return `${v}%`;
  }, [m]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="p">Resumen clínico-operativo del periodo.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="p" style={{ opacity: 0.85, margin: 0 }}>
            Rango:
          </div>

          <select
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,.04)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.9)",
              outline: "none",
            }}
            aria-label="Seleccionar rango de días"
          >
            <option value={7}>Próximos 7 días</option>
            <option value={14}>Próximos 14 días</option>
            <option value={30}>Próximos 30 días</option>
          </select>

          <button
            className="btn"
            onClick={() => loadDashboard({ days: rangeDays })}
            disabled={loading}
            style={{ height: 36 }}
            title="Recargar dashboard"
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {err && (
        <div className="card cardPad" style={{ borderColor: "rgba(255,90,122,.35)" }}>
          {err}
        </div>
      )}

      {/* ====== MÉTRICAS (RECORTADAS A 6) ====== */}
      {!m ? (
        <div className="card cardPad">{loading ? "Cargando..." : "Sin métricas disponibles"}</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
          <MetricCard title="Pacientes activos" value={m.total_patients_active ?? 0} onClick={() => goAppointments({ days: rangeDays })} />
          <MetricCard title="Nuevos en rango" value={m.new_patients_in_range ?? 0} />
          <MetricCard title="Notas en rango" value={m.total_notes_in_range ?? 0} />

          <MetricCard title="Citas (rango)" value={m.total_appointments_in_range ?? 0} onClick={() => goAppointments({ days: rangeDays })} />
          <MetricCard title="Agendadas" value={m.scheduled_appointments_in_range ?? 0} onClick={() => goAppointments({ status: "scheduled", days: rangeDays })} />
          <MetricCard title="Canceladas" value={m.cancelled_appointments_in_range ?? 0} onClick={() => goAppointments({ status: "cancelled", days: rangeDays })} />
        </div>
      )}

      {/* ====== PRÓXIMAS CITAS ====== */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Próximas citas</div>
          <div className="p" style={{ margin: 0, opacity: 0.8 }}>
            {rangeDays} días
          </div>
        </div>

        {loadingUpcoming ? (
          <div className="p">Cargando próximas citas...</div>
        ) : upcoming.length === 0 ? (
          <div className="p">No hay próximas citas.</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {upcoming.slice(0, 8).map((a, idx) => (
              <div
                key={a?.id ?? idx}
                className="card"
                style={{
                  padding: 12,
                  borderColor: "rgba(255,255,255,.08)",
                  background: "rgba(255,255,255,.03)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>{getPatientLabel(a)}</div>
                  <StatusBadge status={a?.status ?? "scheduled"} />
                </div>

                <div className="p" style={{ marginTop: 6 }}>
                  {formatDT(a?.start_time || a?.starts_at || a?.date)}
                </div>

                {a?.notes && <div className="p">📝 {a.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====== CITAS POR DÍA ====== */}
      <div className="card cardPad">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Citas por día</div>
          <div className="p" style={{ margin: 0, opacity: 0.8 }}>
            {rangeDays} días
          </div>
        </div>

        {loadingByDay ? (
          <div className="p">Cargando...</div>
        ) : byDay.length === 0 ? (
          <div className="p">No hay datos para “citas por día”.</div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.8 }}>
                  <th style={{ padding: "8px 6px" }}>Día</th>
                  <th style={{ padding: "8px 6px" }}>Total</th>
                  <th style={{ padding: "8px 6px" }}>Agendadas</th>
                  <th style={{ padding: "8px 6px" }}>Canceladas</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((row, idx) => (
                  <tr key={row?.day ?? row?.date ?? idx} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <td style={{ padding: "8px 6px" }}>{row?.day ?? row?.date ?? "-"}</td>
                    <td style={{ padding: "8px 6px" }}>{row?.total ?? row?.count ?? 0}</td>
                    <td style={{ padding: "8px 6px" }}>{row?.scheduled ?? 0}</td>
                    <td style={{ padding: "8px 6px" }}>{row?.cancelled ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* (solo para que no se quede “sin uso” el memo) */}
      <div style={{ display: "none" }}>{utilizationText}</div>
    </div>
  );
}