import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import FullCalendar from "@fullcalendar/react";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

import { CalendarAPI } from "../api/calendar";
import DayAvailabilityModal from "../components/DayAvailabilityModal";

function isoDate(d) {
  // d: Date
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  // FullCalendar controla el rango visible
  const [range, setRange] = useState({ from: null, to: null });

  // eventos por día (resumen)
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // modal slots
  const [openSlots, setOpenSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [daySlots, setDaySlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const dayMap = useMemo(() => {
    const map = new Map();
    (days || []).forEach((d) => map.set(d.date, d));
    return map;
  }, [days]);

  async function loadCalendar(from, to) {
    setErr("");
    setLoading(true);
    try {
      const res = await CalendarAPI.events(from, to);
      setDays(res?.days || []);
    } catch (e) {
      setDays([]);
      setErr(e?.message || "No se pudo cargar calendario");
    } finally {
      setLoading(false);
    }
  }

async function openDay(dateStr) {
  setSelectedDate(dateStr);
  setOpenSlots(true);
  setLoadingSlots(true);

  try {
    const res = await CalendarAPI.daySlots(dateStr);
    setDaySlots(res?.slots || []);
  } catch (e) {
    setDaySlots([]);
  } finally {
    setLoadingSlots(false);
  }
}

  function handleSchedule(timeStr) {
    // ✅ No rompemos nada: mandamos a /appointments con query "prefill"
    // Si tu página de citas no los usa, no pasa nada.
    const qs = new URLSearchParams({
      date: selectedDate,
      time: timeStr,
    }).toString();
    navigate(`/appointments?${qs}`);
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="p" style={{ marginTop: 6 }}>
            Calendario mensual (citas y bloqueos).
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            if (range.from && range.to) loadCalendar(range.from, range.to);
          }}
          disabled={loading || !range.from || !range.to}
          style={{ height: 36 }}
          title="Recargar calendario"
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {err && (
        <div className="card cardPad" style={{ borderColor: "rgba(255,90,122,.35)" }}>
          {err}
        </div>
      )}

      <div className="card cardPad">
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Calendario</div>

        {/* FullCalendar */}
        <div style={{ opacity: loading ? 0.7 : 1 }}>
          <FullCalendar
  plugins={[dayGridPlugin, interactionPlugin]}
  initialView="dayGridMonth"
  locale={esLocale}
  buttonText={{
    today: "Hoy",
  }}
  height="auto"
  contentHeight="auto"
  aspectRatio={1.15}
  fixedWeekCount={false}
  dayMaxEventRows={2}
  headerToolbar={{
    left: "prev,next today",
    center: "title",
    right: "",
  }}
  datesSet={(arg) => {
    const from = arg.startStr.slice(0, 10);
    const to = arg.endStr.slice(0, 10);

    setRange({ from, to });
    loadCalendar(from, to);
  }}
  dateClick={(info) => {
    const dateStr = info.dateStr;
    openDay(dateStr);
  }}
  dayCellDidMount={(info) => {
    const dateStr = isoDate(info.date);
    const data = dayMap.get(dateStr);

    if (!data) return;

    const el = info.el;
    const badge = document.createElement("div");
    badge.style.marginTop = "4px";
    badge.style.display = "flex";
    badge.style.gap = "4px";
    badge.style.flexWrap = "wrap";
    badge.style.alignItems = "flex-start";

    if (data.all_day_blocked) {
      const b = document.createElement("span");
      b.textContent = "Bloqueado";
      b.style.fontSize = "10px";
      b.style.fontWeight = "800";
      b.style.padding = "2px 6px";
      b.style.borderRadius = "999px";
      b.style.border = "1px solid rgba(255,90,122,.35)";
      b.style.background = "rgba(255,90,122,.12)";
      badge.appendChild(b);
    }

    if ((data.booked || 0) > 0) {
      const b = document.createElement("span");
      b.textContent = `Citas: ${data.booked}`;
      b.style.fontSize = "10px";
      b.style.fontWeight = "800";
      b.style.padding = "2px 6px";
      b.style.borderRadius = "999px";
      b.style.border = "1px solid rgba(80,160,255,.35)";
      b.style.background = "rgba(80,160,255,.12)";
      badge.appendChild(b);
    }

    if ((data.completed || 0) > 0) {
      const b = document.createElement("span");
      b.textContent = `Comp: ${data.completed}`;
      b.style.fontSize = "10px";
      b.style.fontWeight = "800";
      b.style.padding = "2px 6px";
      b.style.borderRadius = "999px";
      b.style.border = "1px solid rgba(80,220,160,.35)";
      b.style.background = "rgba(80,220,160,.12)";
      badge.appendChild(b);
    }

    el.appendChild(badge);
  }}
/>
        </div>

        {loading && <div className="p" style={{ marginTop: 10 }}>Cargando calendario...</div>}
      </div>

      <DayAvailabilityModal
        open={openSlots}
        onClose={() => setOpenSlots(false)}
        date={selectedDate}
        slots={
          loadingSlots
            ? [{ start: "—", end: "—", status: "blocked" }]
            : daySlots
        }
        onSchedule={handleSchedule}
      />
    </div>
  );
}