import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { NotesAPI } from "../api/notes";
import { AppointmentsAPI } from "../api/appointments";
import { PatientsAPI } from "../api/patients";

export default function Notes() {
  const [items, setItems] = useState([]);
  const [appts, setAppts] = useState([]);
  const [patients, setPatients] = useState([]);

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  // Crear nota
  const [appointment_id, setAppointmentId] = useState("");
  const [note_type, setType] = useState("soap");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [content, setContent] = useState("");

  // ✅ NUEVO: modal de notas por paciente
  const [openPatient, setOpenPatient] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientNotes, setPatientNotes] = useState([]);
  const [loadingPatientNotes, setLoadingPatientNotes] = useState(false);
  const [searchPatientNotes, setSearchPatientNotes] = useState("");

  // ✅ NUEVO: buscador en listado principal
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const [notesData, apptsData, patientsData] = await Promise.all([
        NotesAPI.list(),
        AppointmentsAPI.list(),
        PatientsAPI.list(),
      ]);

      setItems(notesData || []);
      setAppts(apptsData || []);
      setPatients(patientsData || []);
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error cargando datos de notas",
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const patientMap = useMemo(() => {
    const m = new Map();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  const apptMap = useMemo(() => {
    const m = new Map();
    for (const a of appts) m.set(a.id, a);
    return m;
  }, [appts]);

  function labelNoteType(t) {
    if (!t) return "—";
    if (t === "soap") return "Nota clínica";
    if (t === "general") return "Nota general";
    return t;
  }

  function labelStatusEs(status) {
  const s = String(status || "").toLowerCase().trim();
  if (s === "scheduled") return "Agendada";
  if (s === "completed") return "Completada";
  if (s === "cancelled") return "Cancelada";
  if (s === "no_show" || s === "no-show" || s === "noshow") return "No asistió";
  return status || "—";
}

function apptLabel(a) {
  if (!a) return "—";
  const when = a.start_time ? dayjs(a.start_time).format("YYYY-MM-DD HH:mm") : `#${a.id}`;
  const st = labelStatusEs(a.status);
  return `${when} — ${st}`;
}

  function patientNameById(id) {
    const p = patientMap.get(id);
    return p?.full_name || p?.name || `Paciente #${id}`;
  }

  function isToday(dt) {
    if (!dt) return false;
    try {
      return dayjs(dt).isSame(dayjs(), "day");
    } catch {
      return false;
    }
  }

  // ✅ Para ordenar notas: las que son de cita de HOY arriba (si aplica), luego por created_at desc
  const sortedItems = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];

    arr.sort((a, b) => {
      const apA = apptMap.get(a.appointment_id);
      const apB = apptMap.get(b.appointment_id);

      const aToday = isToday(apA?.start_time);
      const bToday = isToday(apB?.start_time);

      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;

      const aCreated = a?.created_at ? dayjs(a.created_at).valueOf() : 0;
      const bCreated = b?.created_at ? dayjs(b.created_at).valueOf() : 0;
      return bCreated - aCreated;
    });

    return arr;
  }, [items, apptMap]);

  // ✅ Buscador del listado principal
  const filteredMain = useMemo(() => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return sortedItems;

    return sortedItems.filter((n) => {
      const a = apptMap.get(n.appointment_id);
      const pid = n.patient_id ?? a?.patient_id;
      const pname = patientNameById(pid);
      const type = labelNoteType(n.note_type);
      const when = a?.start_time ? dayjs(a.start_time).format("YYYY-MM-DD HH:mm") : "";
      const created = n.created_at ? dayjs(n.created_at).format("YYYY-MM-DD HH:mm") : "";

      const hay =
        `${pname} ${type} ${when} ${created} ${n.subjective || ""} ${n.objective || ""} ${n.assessment || ""} ${
          n.plan || ""
        } ${n.content || ""}`.toLowerCase();

      return hay.includes(q);
    });
  }, [search, sortedItems, apptMap, patientMap]);

  async function create() {
    try {
      if (!appointment_id) {
        setToast({ show: true, type: "Advertencia", message: "Selecciona una cita" });
        return;
      }

      const payload = {
        appointment_id: Number(appointment_id),
        note_type,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        content: content || null,
      };

      await NotesAPI.create(payload);

      setToast({ show: true, type: "Éxito", message: "Nota creada" });
      setOpen(false);
      setAppointmentId("");
      setSubjective("");
      setObjective("");
      setAssessment("");
      setPlan("");
      setContent("");

      await load();

      // ✅ Si el modal de paciente está abierto, refrescamos solo ese paciente desde backend
      if (openPatient && selectedPatientId) {
        await openPatientNotes(selectedPatientId, { keepOpen: true });
      }
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error creando nota",
      });
    }
  }

  // ✅ Abrir modal y cargar notas por paciente usando backend (/notes/by-patient/:id)
  async function openPatientNotes(patientId, opts = {}) {
    const id = Number(patientId);
    if (!id) return;

    try {
      setSelectedPatientId(id);
      setLoadingPatientNotes(true);

      const data = await NotesAPI.byPatient(id);
      setPatientNotes(Array.isArray(data) ? data : []);

      if (!opts.keepOpen) setOpenPatient(true);
      else setOpenPatient(true);
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "No se pudieron cargar notas del paciente",
      });
    } finally {
      setLoadingPatientNotes(false);
    }
  }

  // ✅ Agrupar notas del paciente por día
  const patientNotesGrouped = useMemo(() => {
    const q = (searchPatientNotes || "").toLowerCase().trim();
    const arr = Array.isArray(patientNotes) ? [...patientNotes] : [];

    // Orden: más reciente primero (por created_at)
    arr.sort((a, b) => {
      const aCreated = a?.created_at ? dayjs(a.created_at).valueOf() : 0;
      const bCreated = b?.created_at ? dayjs(b.created_at).valueOf() : 0;
      return bCreated - aCreated;
    });

    // Filtro
    const filtered = !q
      ? arr
      : arr.filter((n) => {
          const a = apptMap.get(n.appointment_id);
          const when = a?.start_time ? dayjs(a.start_time).format("YYYY-MM-DD HH:mm") : "";
          const created = n.created_at ? dayjs(n.created_at).format("YYYY-MM-DD HH:mm") : "";
          const type = labelNoteType(n.note_type);

          const hay =
            `${type} ${when} ${created} ${n.subjective || ""} ${n.objective || ""} ${n.assessment || ""} ${
              n.plan || ""
            } ${n.content || ""}`.toLowerCase();

          return hay.includes(q);
        });

    // Group key: preferimos la fecha de la CITA, si no, created_at
    const groups = new Map();
    for (const n of filtered) {
      const a = apptMap.get(n.appointment_id);
      const key = a?.start_time
        ? dayjs(a.start_time).format("YYYY-MM-DD")
        : n.created_at
        ? dayjs(n.created_at).format("YYYY-MM-DD")
        : "Sin fecha";

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    }

    // Convertimos a array y ordenamos grupos por fecha desc, pero "HOY" arriba
    const out = Array.from(groups.entries()).map(([date, notes]) => ({ date, notes }));

    out.sort((g1, g2) => {
      const t1 = dayjs(g1.date).valueOf();
      const t2 = dayjs(g2.date).valueOf();
      const g1Today = dayjs(g1.date).isSame(dayjs(), "day");
      const g2Today = dayjs(g2.date).isSame(dayjs(), "day");
      if (g1Today && !g2Today) return -1;
      if (!g1Today && g2Today) return 1;
      return t2 - t1;
    });

    return out;
  }, [patientNotes, searchPatientNotes, apptMap]);

  // ✅ Para “Nueva nota para este paciente”: intenta preseleccionar cita de HOY o la más reciente
  function pickDefaultAppointmentForPatient(patientId) {
    const id = Number(patientId);
    const patientAppts = appts
      .filter((a) => Number(a.patient_id) === id)
      .sort((a, b) => {
        const ta = a?.start_time ? dayjs(a.start_time).valueOf() : 0;
        const tb = b?.start_time ? dayjs(b.start_time).valueOf() : 0;
        return tb - ta;
      });

    // Primero cita de HOY (si existe)
    const todayAppt = patientAppts.find((a) => isToday(a?.start_time));
    if (todayAppt) return todayAppt.id;

    // Si no, la más reciente
    if (patientAppts[0]) return patientAppts[0].id;

    return "";
  }

  function startNewNoteForPatient(patientId) {
    const apptId = pickDefaultAppointmentForPatient(patientId);
    setAppointmentId(apptId ? String(apptId) : "");
    setType("soap");
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setContent("");
    setOpen(true);
  }

  return (
    <div className="grid">
      <div className="row">
        <div>
          <h1 className="h1">Notas clínicas</h1>
          <p className="p"> General, ligadas a una cita.</p>
        </div>
        <div className="spacer" />
        <button className="btn btnPrimary" onClick={() => setOpen(true)}>
          + Nueva nota
        </button>
      </div>

      {/* ✅ Buscador principal */}
      <div className="card cardPad" style={{ marginBottom: 12 }}>
        <label className="label">Buscar</label>
        <input
          className="input"
          placeholder="Buscar por paciente, tipo, fecha, contenido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="p" style={{ marginTop: 8, color: "var(--muted)" }}>
          Tip: el paciente con cita de hoy (si existe) aparece arriba.
        </div>
      </div>

      <div className="card cardPad">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cita</th>
              <th>Paciente</th>
              <th>Tipo</th>
              <th>Creada</th>
            </tr>
          </thead>

          <tbody>
            {filteredMain.map((n) => {
              const a = apptMap.get(n.appointment_id);
              const pid = n.patient_id ?? a?.patient_id;
              const patientName = patientNameById(pid);

              return (
                <tr key={n.id}>
                  <td>#{n.id}</td>
                  <td>{a ? apptLabel(a) : `Cita #${n.appointment_id}`}</td>

                  {/* ✅ CLICK en paciente -> abre sus notas por día */}
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "6px 10px" }}
                      onClick={() => openPatientNotes(pid)}
                      title="Ver notas del paciente"
                    >
                      {patientName}
                    </button>
                  </td>

                  <td>{labelNoteType(n.note_type)}</td>
                  <td>{n.created_at ? dayjs(n.created_at).format("YYYY-MM-DD HH:mm") : "—"}</td>
                </tr>
              );
            })}

            {filteredMain.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  Sin notas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Modal Crear nota */}
      <Modal
        open={open}
        title="Nueva nota clínica"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn btnPrimary" onClick={create}>
              Guardar
            </button>
          </>
        }
      >
        <label className="label">Cita</label>
        <select className="select" value={appointment_id} onChange={(e) => setAppointmentId(e.target.value)}>
          <option value="">Selecciona…</option>
          {appts.map((a) => {
            const pName = patientNameById(a.patient_id);
            const when = a.start_time ? dayjs(a.start_time).format("YYYY-MM-DD HH:mm") : `#${a.id}`;
            return (
              <option key={a.id} value={a.id}>
                #{a.id} — {pName} — {when} — {a.status}
              </option>
            );
          })}
        </select>

        <label className="label">Tipo</label>
        <select className="select" value={note_type} onChange={(e) => setType(e.target.value)}>
          <option value="soap">Nota clínica</option>
          <option value="general">Nota general</option>
        </select>

        <label className="label">Diagnóstico</label>
        <textarea className="textarea" value={subjective} onChange={(e) => setSubjective(e.target.value)} />

        <label className="label">Objetivo</label>
        <textarea className="textarea" value={objective} onChange={(e) => setObjective(e.target.value)} />

        <label className="label">Evaluación</label>
        <textarea className="textarea" value={assessment} onChange={(e) => setAssessment(e.target.value)} />

        <label className="label">Plan</label>
        <textarea className="textarea" value={plan} onChange={(e) => setPlan(e.target.value)} />

        <label className="label">Contenido (nota simple opcional)</label>
        <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} />
      </Modal>

      {/* ✅ Modal: Notas por paciente (por día + buscador) */}
      <Modal
        open={openPatient}
        title={`Notas de ${selectedPatientId ? patientNameById(selectedPatientId) : "Paciente"}`}
        onClose={() => {
          setOpenPatient(false);
          setSelectedPatientId(null);
          setPatientNotes([]);
          setSearchPatientNotes("");
        }}
        footer={
          <>
            {selectedPatientId && (
              <button className="btn btnPrimary" onClick={() => startNewNoteForPatient(selectedPatientId)}>
                + Nueva nota para este paciente
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setOpenPatient(false);
                setSelectedPatientId(null);
                setPatientNotes([]);
                setSearchPatientNotes("");
              }}
            >
              Cerrar
            </button>
          </>
        }
      >
        <label className="label">Buscar en notas de este paciente</label>
        <input
          className="input"
          placeholder="Buscar texto dentro de sus notas..."
          value={searchPatientNotes}
          onChange={(e) => setSearchPatientNotes(e.target.value)}
        />

        <div className="p" style={{ marginTop: 10, color: "var(--muted)" }}>
          Se agrupan por día (prioridad: fecha de la cita).
        </div>

        {loadingPatientNotes ? (
          <div className="p" style={{ marginTop: 10 }}>
            Cargando notas...
          </div>
        ) : patientNotesGrouped.length === 0 ? (
          <div className="p" style={{ marginTop: 10 }}>
            Sin notas para este paciente.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {patientNotesGrouped.map((g) => (
              <div key={g.date} className="card cardPad" style={{ background: "rgba(255,255,255,.03)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>
                    {g.date} {dayjs(g.date).isSame(dayjs(), "day") ? "— HOY" : ""}
                  </div>
                  <div className="p" style={{ margin: 0, opacity: 0.8 }}>
                    {g.notes.length} nota(s)
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  {g.notes.map((n) => {
                    const a = apptMap.get(n.appointment_id);
                    const when = a?.start_time ? dayjs(a.start_time).format("HH:mm") : "";
                    const created = n.created_at ? dayjs(n.created_at).format("HH:mm") : "";

                    // mini preview sin romper layout
                    const preview =
                      n.subjective ||
                      n.objective ||
                      n.assessment ||
                      n.plan ||
                      n.content ||
                      "";

                    const short = String(preview || "").trim().slice(0, 140);

                    return (
                      <div
                        key={n.id}
                        className="card"
                        style={{
                          padding: 12,
                          borderColor: "rgba(255,255,255,.08)",
                          background: "rgba(255,255,255,.02)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 800 }}>
                            #{n.id} — {labelNoteType(n.note_type)}
                          </div>
                          <div className="p" style={{ margin: 0, opacity: 0.8 }}>
                            {when ? `Cita ${when}` : ""} {created ? `${when ? "• " : ""}Creada ${created}` : ""}
                          </div>
                        </div>

                        {short ? <div className="p" style={{ marginTop: 8 }}>📝 {short}{preview.length > 140 ? "..." : ""}</div> : (
                          <div className="p" style={{ marginTop: 8, color: "var(--muted)" }}>
                            (Nota sin contenido visible)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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