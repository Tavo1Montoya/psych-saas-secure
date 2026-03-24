import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import Modal from "../components/Modal";
import Toast from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import { AppointmentsAPI } from "../api/appointments";
import { PatientsAPI } from "../api/patients";
import { buildSuccessMessage } from "../utils/successMessage.js";
import { getCurrentRoleFromStorage } from "../utils/currentRole.js";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [searchPatientModal, setSearchPatientModal] = useState("");
  

  // status filter
  const [status, setStatus] = useState("");

  // query params
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const currentRole = getCurrentRoleFromStorage();

  // =========================
  // Helpers de fechas
  // =========================

  // datetime-local -> naive local string
  function toNaiveLocalDatetimeString(dtLocalValue) {
    if (!dtLocalValue) return "";
    return dayjs(dtLocalValue).format("YYYY-MM-DDTHH:mm:ss");
  }

  // date + time -> datetime-local
  function toDatetimeLocalValue(dateStr, timeStr) {
    if (!dateStr || !timeStr) return "";
    return `${dateStr}T${timeStr}`;
  }

  // =========================
  // Helpers de filtros
  // =========================
  function buildParamsFromState() {
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
  const data = await PatientsAPI.list();
  setPatients(data || []);
}

  // =========================
  // Cargar pacientes una vez
  // =========================
  useEffect(() => {
    loadPatients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================
  // Sincronizar filtros con URL y cargar listado
  // =========================
  useEffect(() => {
    (async () => {
      const qp_from = searchParams.get("date_from") || "";
      const qp_to = searchParams.get("date_to") || "";
      const qp_status = searchParams.get("status") || "";
      const qp_patient = searchParams.get("patient_id") || "";

      setFrom(qp_from);
      setTo(qp_to);
      setStatus(qp_status);
      setPatientId(qp_patient);

      const params = buildParamsFromQuery(qp_from, qp_to, qp_status, qp_patient);
      await load(params);
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
    useEffect(() => {
  const params = new URLSearchParams(location.search);

  const pickedDate = params.get("date");
  const pickedTime = params.get("time");

  if (!pickedDate || !pickedTime) return;

  const dtLocal = toDatetimeLocalValue(pickedDate, pickedTime);
  if (!dtLocal) return;

  setStartTime(dtLocal);
  setOpen(true);

  params.delete("date");
  params.delete("time");

  const next = params.toString();
  const newUrl = next ? `/appointments?${next}` : "/appointments";
  window.history.replaceState({}, "", newUrl);
}, [location.search]);
  // =========================
  // ✅ NUEVO: si viene desde el calendario con ?date=YYYY-MM-DD&time=HH:mm
  // abre modal y prellena fecha/hora
  // =========================
  const patientMap = useMemo(() => {
     
    const m = new Map();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  const patientAppointmentsCount = useMemo(() => {
  const map = new Map();

  for (const a of items) {
    const month = dayjs(a.start_time).format("YYYY-MM");

    if (!map.has(a.patient_id)) {
      map.set(a.patient_id, {});
    }

    const months = map.get(a.patient_id);

    months[month] = (months[month] || 0) + 1;
  }

  return map;
}, [items]);

function getPatientLabel(appointment) {
  const p = patientMap.get(appointment.patient_id);

  return (
    p?.full_name ||
    p?.name ||
    appointment?.patient_name ||
    p?.alias ||
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

      const startTimeNaive = toNaiveLocalDatetimeString(start_time);

      const payload = {
        patient_id: Number(patient_id),
        start_time: startTimeNaive,
        duration_minutes: Number(duration_minutes),
        status: "scheduled",
        notes: null,
      };

      await AppointmentsAPI.create(payload);

     setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Cita creada"),
});

      // limpiamos modal
      setPatientId("");
      setStartTime("");
      setDuration(60);

      await load();
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
      setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Cita Completada"),
});

      await load();
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error",
      });
    }
  }

  async function noShow(id) {
    try {
      await AppointmentsAPI.noShow(id);
     setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Paciente No Asistió"),
});

      await load();
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error",
      });
    }
  }

  async function cancel(id) {
    if (!confirm("¿Cancelar (desactivar) cita?")) return;

    try {
      await AppointmentsAPI.cancel(id);
      setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Cita Cancelada"),
});

      await load();
      await refreshAvailabilityIfOpen();
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error",
      });
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

  // Click en horario disponible => abrir Crear cita con hora preseleccionada
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
    availabilityResult?.slot_minutes != null
      ? `${availabilityResult.slot_minutes} minutos`
      : "-";

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
        {/* Filtros */}
        <div className="row" style={{ marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
  <div style={{ minWidth: 220, flex: "1 1 220px" }}>
    <label className="label">Desde</label>
    <input
      className="input"
      type="date"
      value={date_from}
      onChange={(e) => setFrom(e.target.value)}
    />
  </div>

  <div style={{ minWidth: 220, flex: "1 1 220px" }}>
    <label className="label">Hasta</label>
    <input
      className="input"
      type="date"
      value={date_to}
      onChange={(e) => setTo(e.target.value)}
    />
  </div>

  <div style={{ minWidth: 220, flex: "1 1 220px" }}>
    <label className="label">Estado</label>
    <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
      <option value="">Todos</option>
      <option value="scheduled">Agendada</option>
      <option value="completed">Completada</option>
      <option value="cancelled">Cancelada</option>
      <option value="no_show">No asistió</option>
    </select>
  </div>

  <div style={{ minWidth: 260, flex: "1 1 260px" }}>
    <label className="label">Paciente</label>
   <select
  className="select"
  value={patient_id}
  onChange={(e) => setPatientId(e.target.value)}
>
  <option value="">Todos</option>

  {patients
    .filter((p) => {
      if (!searchPatientModal) return true;

      const alias = (p.alias || "").toLowerCase();
      const name = (p.full_name || p.name || "").toLowerCase();
      const search = searchPatientModal.toLowerCase();

      return alias.includes(search) || name.includes(search);
    })
    .map((p) => (
      <option key={p.id} value={p.id}>
        #{p.id} — {p.full_name || p.name}
      </option>
    ))}
</select>

{/* ✅ AQUÍ VA EL MENSAJE (FUERA DEL SELECT) */}
{patient_id && (
  <div style={{ marginTop: 6, color: "var(--muted)" }}>
    {(() => {
      const month = dayjs(start_time || new Date()).format("YYYY-MM");

      const data = patientAppointmentsCount.get(Number(patient_id));
      const count = data ? data[month] || 0 : 0;

      if (!count) return null;

      return `Este paciente tiene ${count} citas en este mes`;
    })()}
  </div>
)}
    

      <option value="">Todos</option>

    {patients
      .filter((p) => {
        if (!searchPatientModal) return true;

        const alias = (p.alias || "").toLowerCase();
        const name = (p.full_name || p.name || "").toLowerCase();
        const search = searchPatientModal.toLowerCase();

        return alias.includes(search) || name.includes(search);
      })
      .map((p) => (
        <option key={p.id} value={p.id}>
          #{p.id} — {p.full_name || p.name}
        </option>
      ))}
    </select>
  </div>
{/* Nuevo buscador por Alias */}
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    
  </label>
  <input
    type="text"
    placeholder="Buscar por alias"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="w-full p-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-purple-500 outline-none"
    style={{ borderRadius: '25px', paddingLeft: '15px' }} // Para que combine con tu UI
  />
</div>
  <div style={{ alignSelf: "end", display: "flex", gap: 8, flexWrap: "wrap" }}>
    <button className="btn" onClick={() => load()}>
      Filtrar
    </button>

    <button className="btn" onClick={checkAvailability}>
      Probar disponibilidad
    </button>
  </div>
</div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Alias</th>
                <th>Paciente</th>
                <th>Inicio</th>
                <th>Duración</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>

          <tbody>
            {items
             .filter((a) => {
                if (!searchTerm) return true;

                const p = patientMap.get(a.patient_id);

                const alias = (p?.alias || "").toLowerCase();
                const name = (p?.full_name || "").toLowerCase();

                const search = searchTerm.toLowerCase();

                return alias.includes(search) || name.includes(search);
              })
              .map((a) => {
                // Obtenemos el paciente del mapa para mostrar el alias
                const p = patientMap.get(a.patient_id);
                return (
                  <tr key={a.id}>
                    {/* Cambiamos el ID por el Alias del paciente */}
                    <td style={{ fontWeight: 'bold' }}>{p?.alias || "---"}</td>
                    
                    <td>{getPatientLabel(a)}</td>

                    <td>{dayjs(a.start_time).format("DD/MM/YYYY HH:mm")}</td>
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
                        <button
                          className="btn"
                          style={{ whiteSpace: "nowrap" }}
                          onClick={() => complete(a.id)}
                        >
                          Completada
                        </button>
                        <button
                          className="btn"
                          style={{ whiteSpace: "nowrap" }}
                          onClick={() => noShow(a.id)}
                        >
                          No asistió
                        </button>
                        <button
                          className="btn btnDanger"
                          style={{ whiteSpace: "nowrap" }}
                          onClick={() => cancel(a.id)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

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
      </div>

      {/* Modal Crear cita */}
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

  <div style={{ position: "relative" }}>
  <input
    type="text"
    placeholder="Buscar por alias o nombre..."
    value={searchPatientModal}
    onChange={(e) => setSearchPatientModal(e.target.value)}
    className="input"
  />

  {searchPatientModal && (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 6,
        maxHeight: 200,
        overflowY: "auto",
        zIndex: 10,
      }}
    >
      {patients
        .filter((p) => {
          const alias = (p.alias || "").toLowerCase();
          const name = (p.full_name || p.name || "").toLowerCase();
          const search = searchPatientModal.toLowerCase();

          return alias.includes(search) || name.includes(search);
        })
        .map((p) => (
          <div
            key={p.id}
            onClick={() => {
              setPatientId(p.id);
              setSearchPatientModal(
                `${p.alias ? p.alias + " - " : ""}${p.full_name || p.name}`
              );
            }}
            style={{
              padding: 10,
              cursor: "pointer",
              borderBottom: "1px solid #eee",
            }}
          >
            {p.alias ? `${p.alias} - ` : ""}
            {p.full_name || p.name}
          </div>
        ))}
    </div>
  )}
</div>
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

      {/* Modal Disponibilidad */}
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
            <div
              className="row"
              style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
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
                  {slots.map((slotRaw) => {
                        // 🔥 compatibilidad: string o objeto
                        const slot =
                          typeof slotRaw === "string"
                            ? { time: slotRaw, occupied: false }
                            : slotRaw;

                        return (
                          <button
                            key={`${dateStr}-${slot.time}`}
                            type="button"
                            className="btn"
                            style={{
                              padding: "8px 10px",
                              background: slot.occupied ? "#ffe5e5" : "",
                              border: slot.occupied ? "1px solid #ffb3b3" : "",
                            }}
                            onClick={() =>
                              !slot.occupied && handlePickSlot(dateStr, slot.time)
                            }
                            title={
                              slot.occupied
                                ? `${slot.patient || ""} (${slot.alias || ""})`
                                : "Click para crear cita en este horario"
                            }
                          >
                            {slot.time}

                            {slot.occupied && (
                              <div style={{ fontSize: 10 }}>
                                {slot.alias || slot.patient}
                              </div>
                            )}
                          </button>
                        );
                      })}
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