import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import { AppointmentsAPI } from "../api/appointments";
import { PatientsAPI } from "../api/patients";
import { useSearchParams } from "react-router-dom";

export default function Appointments() {
  const [items, setItems] = useState([]);
  const [patients, setPatients] = useState([]);
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  const [open, setOpen] = useState(false);
  const [patient_id, setPatientId] = useState("");
  const [start_time, setStartTime] = useState(""); // datetime-local (LOCAL)
  const [duration_minutes, setDuration] = useState(60);

  // Availability modal
  const [openAvailability, setOpenAvailability] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState(null);

  // filtros
  const [date_from, setFrom] = useState("");
  const [date_to, setTo] = useState("");

  // ✅ status filter (viene del dashboard)
  const [status, setStatus] = useState("");

  // ✅ leer query params
  const [searchParams] = useSearchParams();

  // =========================
  // Helpers de fechas (NO tocar)
  // =========================

  // ✅ Convierte datetime-local -> string "naive" (SIN UTC, SIN Z)
  // Ej: "2026-02-11T12:00" -> "2026-02-11T12:00:00"
  function toNaiveLocalDatetimeString(dtLocalValue) {
    if (!dtLocalValue) return "";
    return dayjs(dtLocalValue).format("YYYY-MM-DDTHH:mm:ss");
  }

  // ✅ Helper: formar value compatible con <input type="datetime-local">
  // date: "2026-11-11", time: "10:30" => "2026-11-11T10:30"
  function toDatetimeLocalValue(dateStr, timeStr) {
    if (!dateStr || !timeStr) return "";
    return `${dateStr}T${timeStr}`;
  }

  // =========================
  // Helpers de filtros
  // =========================
  function buildParamsFromState() {
    // ✅ Solo mandamos lo que tenga valor
    const params = {
      ...(date_from ? { date_from } : {}),
      ...(date_to ? { date_to } : {}),
      ...(status ? { status } : {}),
      ...(patient_id ? { patient_id } : {}),
    };
    return Object.keys(params).length ? params : undefined;
  }

  function buildParamsFromQuery(qp_from, qp_to, qp_status, qp_patient) {
    const params = {
      ...(qp_from ? { date_from: qp_from } : {}),
      ...(qp_to ? { date_to: qp_to } : {}),
      ...(qp_status ? { status: qp_status } : {}),
      ...(qp_patient ? { patient_id: qp_patient } : {}),
    };
    return Object.keys(params).length ? params : undefined;
  }

  // =========================
  // Loaders
  // =========================
  async function load(customParams) {
    const params = customParams ?? buildParamsFromState();
    const data = await AppointmentsAPI.list(params);
    setItems(data || []);
  }

  async function loadPatients() {
    const p = await PatientsAPI.list();
    setPatients(p || []);
  }

  // =========================
  // ✅ Al montar: cargar pacientes una vez
  // =========================
  useEffect(() => {
    loadPatients();
 // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // ✅ ÚNICO efecto para URL: cada vez que cambie searchParams
  //    - sincroniza estado de filtros
  //    - recarga citas automáticamente
  // =========================
  useEffect(() => {
    (async () => {
      const qp_from = searchParams.get("date_from") || "";
      const qp_to = searchParams.get("date_to") || "";
      const qp_status = searchParams.get("status") || "";
      const qp_patient = searchParams.get("patient_id") || "";

      // ✅ reflejar en UI (si no vienen, dejamos "" para que sea “Todos”)
      setFrom(qp_from);
      setTo(qp_to);
      setStatus(qp_status);
      setPatientId(qp_patient);

      // ✅ recargar citas con esos params (sin depender del estado viejo)
      const params = buildParamsFromQuery(qp_from, qp_to, qp_status, qp_patient);
      await load(params);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const patientMap = useMemo(() => {
    const m = new Map();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  // ✅ Helper: resolver nombre de paciente (prioridad: patientsMap -> patient_name -> fallback)
  function getPatientLabel(appointment) {
    const p = patientMap.get(appointment.patient_id);
    return (
      p?.full_name ||
      p?.name ||
      appointment?.patient_name || // 👈 viene del backend (AppointmentResponse)
      `patient_id:${appointment.patient_id}`
    );
  }

  async function refreshAvailabilityIfOpen() {
    try {
      if (!openAvailability) return;
      if (!date_from || !date_to) return;

      const data = await AppointmentsAPI.availability({ date_from, date_to });
      setAvailabilityResult(data);
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "No se pudo refrescar disponibilidad",
      });
    }
  }

  // =========================
  // CRUD
  // =========================
  async function create() {
    try {
      if (!patient_id) {
        setToast({ show: true, type: "Advertencia", message: "Selecciona un paciente" });
        return;
      }
      if (!start_time) {
        setToast({ show: true, type: "Advertencia", message: "Selecciona fecha y hora" });
        return;
      }

      // ✅ IMPORTANTE: NO usar toISOString() (eso lo vuelve UTC y rompe el horario)
      const startTimeNaive = toNaiveLocalDatetimeString(start_time);

      const payload = {
        patient_id: Number(patient_id),
        start_time: startTimeNaive, // ✅ LOCAL naive
        duration_minutes: Number(duration_minutes),
        status: "scheduled",
        notes: null,
      };

      await AppointmentsAPI.create(payload);

      setToast({ show: true, type: "Éxito", message: "Cita creada" });
      setOpen(false);

      // ✅ limpiamos modal, NO filtros del listado
      setStartTime("");
      setDuration(60);

      await load(); // respeta filtros actuales
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error creando cita",
      });
    }
  }

  async function complete(id) {
    try {
      await AppointmentsAPI.complete(id);
      setToast({ show: true, type: "Éxito", message: "Cita completada" });

      await load();
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({ show: true, type: "Advertencia", message: e?.response?.data?.detail || "Error" });
    }
  }

  async function noShow(id) {
    try {
      await AppointmentsAPI.noShow(id);
      setToast({ show: true, type: "Éxito", message: "Marcada como no-show" });

      await load();
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({ show: true, type: "Advertencia", message: e?.response?.data?.detail || "Error" });
    }
  }

  async function cancel(id) {
    if (!confirm("¿Cancelar (desactivar) cita?")) return;
    try {
      await AppointmentsAPI.cancel(id);
      setToast({ show: true, type: "Éxito", message: "Cita cancelada" });

      await load();
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({ show: true, type: "Advertencia", message: e?.response?.data?.detail || "Error" });
    }
  }

  async function checkAvailability() {
    try {
      if (!date_from || !date_to) {
        setToast({ show: true, type: "Advertencia", message: "Define 'Desde' y 'Hasta'" });
        return;
      }

      const data = await AppointmentsAPI.availability({ date_from, date_to });
      setAvailabilityResult(data);
      setOpenAvailability(true);
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error al consultar disponibilidad",
      });
    }
  }

  // ✅ Click en un horario disponible => abre Crear cita y pre-llena la hora
  function handlePickSlot(dateStr, timeStr) {
    const dtLocal = toDatetimeLocalValue(dateStr, timeStr);
    if (!dtLocal) return;

    setStartTime(dtLocal);
    setOpenAvailability(false);
    setOpen(true);
  }

  // =========================
  // UI helpers para Availability
  // =========================
  const availRangeLabel =
    availabilityResult?.date_from && availabilityResult?.date_to
      ? `${availabilityResult.date_from} → ${availabilityResult.date_to}`
      : "-";

  const availWorkHoursLabel =
    availabilityResult?.working_hours?.start_time && availabilityResult?.working_hours?.end_time
      ? `${availabilityResult.working_hours.start_time} a ${availabilityResult.working_hours.end_time}`
      : "-";

  const slotMinutesLabel =
    availabilityResult?.slot_minutes != null ? `${availabilityResult.slot_minutes} minutos` : "-";

  const durationMinutesLabel =
    availabilityResult?.duration_minutes != null
      ? `${availabilityResult.duration_minutes} minutos`
      : `${duration_minutes} minutos`;

  const availDays = Array.isArray(availabilityResult?.days) ? availabilityResult.days : [];

  // =========================
  // Render
  // =========================
  return (
    <div className="grid">
      <div className="row">
        <div>
          <h1 className="h1">Citas</h1>
          <p className="p">Agenda con validación de horario, traslapes y estados.</p>
        </div>
        <div className="spacer" />
        <button className="btn btnPrimary" onClick={() => setOpen(true)}>
          + Crear cita
                  </button>
      </div>

      <div className="card cardPad">
        {/* ✅ Filtros */}
        <div className="row" style={{ marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220 }}>
            <label className="label">Desde</label>
            <input
              className="input"
              type="date"
              value={date_from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          </div>

          <div style={{ minWidth: 220 }}>
            <label className="label">Hasta</label>
            <input
              className="input"
              type="date"
              value={date_to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <label className="label">Estado</label>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="scheduled">Agendada</option>
              <option value="completed">Completada</option>
              <option value="cancelled">Cancelada</option>
              <option value="no_show">No asistió</option>
            </select>
          </div>

          <div style={{ minWidth: 260 }}>
            <label className="label">Paciente</label>
            <select className="select" value={patient_id} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Todos</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} — {p.full_name || p.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: "end" }}>
            <button className="btn" onClick={() => load()}>
              Filtrar
            </button>
          </div>

          <div style={{ alignSelf: "end" }}>
            <button className="btn" onClick={checkAvailability}>
              Probar disponibilidad
            </button>
          </div>
        </div>

        <div className="tableWrap">
          <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Paciente</th>
              <th>Inicio</th>
              <th>Duración</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>#{a.id}</td>
                <td>{getPatientLabel(a)}</td>
                <td>{dayjs(a.start_time).format("YYYY-MM-DD HH:mm")}</td>
                <td>{a.duration_minutes} min</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>

               <td style={{ textAlign: "right" }}>
  <div
    className="row"
    style={{
      justifyContent: "flex-end",
      flexWrap: "nowrap",
      gap: 8,
      overflowX: "auto",
      maxWidth: "100%",
      paddingBottom: 2,
    }}
  >
    <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={() => complete(a.id)}>
      Completada
    </button>
    <button className="btn" style={{ whiteSpace: "nowrap" }} onClick={() => noShow(a.id)}>
      No asistió
    </button>
    <button className="btn btnDanger" style={{ whiteSpace: "nowrap" }} onClick={() => cancel(a.id)}>
      Cancelar
    </button>
  </div>
</td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)" }}>
                  Sin citas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Modal Crear cita */}
      <Modal
        open={open}
        title="Crear cita"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn btnPrimary" onClick={create}>
              Crear
            </button>
          </>
        }
      >
        <label className="label">Paciente</label>
        <select className="select" value={patient_id} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Selecciona…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} — {p.full_name || p.name}
            </option>
          ))}
        </select>

        <label className="label">Fecha/hora (local)</label>
        <input
          className="input"
          type="datetime-local"
          value={start_time}
          onChange={(e) => setStartTime(e.target.value)}
        />

        <label className="label">Duración (min)</label>
        <input
          className="input"
          type="number"
          value={duration_minutes}
          onChange={(e) => setDuration(e.target.value)}
        />
      </Modal>

      {/* ✅ Modal Disponibilidad */}
      <Modal
        open={openAvailability}
        title="Disponibilidad de agenda"
        onClose={() => setOpenAvailability(false)}
        footer={
          <>
            <button className="btn" onClick={() => setOpenAvailability(false)}>
              Cerrar
            </button>
          </>
        }
      >
        <div className="grid" style={{ gap: 12 }}>
          {/* Resumen */}
          <div className="card cardPad">
            <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="label">Rango consultado</div>
                <div className="p" style={{ margin: 0 }}>
                  {availRangeLabel}
                </div>

                <div className="label" style={{ marginTop: 10 }}>
                  Horario de atención
                </div>
                <div className="p" style={{ margin: 0 }}>
                  {availWorkHoursLabel}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="label">Duración por cita</div>
                <div className="p" style={{ margin: 0 }}>
                  {durationMinutesLabel}
                </div>

                <div className="label" style={{ marginTop: 10 }}>
                  Intervalo de agenda
                </div>
                <div className="p" style={{ margin: 0 }}>
                  {slotMinutesLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Horarios */}
          <div className="card cardPad">
            <div className="label">Horarios disponibles</div>

            {availDays.length === 0 && (
              <div className="p" style={{ marginTop: 8, color: "var(--muted)" }}>
                No hay horarios disponibles para el rango consultado.
              </div>
            )}

            {availDays.map((d, i) => {
              const dateStr = d?.date;
              const slots = Array.isArray(d?.slots) ? d.slots : [];

              return (
                <div key={dateStr || `day-${i}`} style={{ marginTop: 10 }}>
                  <div className="p" style={{ margin: "6px 0" }}>
                    <b>{dateStr || "Fecha"}</b>
                  </div>

                  {slots.length === 0 ? (
                    <div className="p" style={{ color: "var(--muted)", margin: 0 }}>
                      Sin horarios disponibles este día.
                    </div>
                  ) : (
                    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                      {slots.map((t) => (
                        <button
                          key={`${dateStr}-${t}`}
                          type="button"
                          className="btn"
                          style={{ padding: "8px 10px" }}
                          onClick={() => handlePickSlot(dateStr, t)}
                          title="Click para crear cita en este horario"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="p" style={{ marginTop: 12, color: "var(--muted)" }}>
              Tip: da click en un horario para abrir “Crear cita” con la hora ya seleccionada.
            </div>
          </div>
        </div>
      </Modal>

      <Toast
        show={toast.show}
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  );
}