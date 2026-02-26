// src/components/StatusBadge.jsx
export default function StatusBadge({ status }) {
  const raw = String(status || "").trim();
  const s = raw.toLowerCase();

  // ✅ clases (no rompemos tu CSS actual)
  let cls = "badgeWarn";
  if (s === "completed") cls = "badgeOk";
  if (s === "cancelled" || s === "no-show" || s === "noshow" || s === "no_show") cls = "badgeDanger";

  // ✅ texto visible en español
  let label = raw || "—";
  if (s === "scheduled") label = "Agendada";
  else if (s === "completed") label = "Completada";
  else if (s === "cancelled") label = "Cancelada";
  else if (s === "no-show" || s === "noshow" || s === "no_show") label = "No asistió";

  return <span className={`badge ${cls}`}>{label}</span>;
}