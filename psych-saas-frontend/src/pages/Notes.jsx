import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { NotesAPI } from "../api/notes";
import { AppointmentsAPI } from "../api/appointments";
import { PatientsAPI } from "../api/patients";
import { buildSuccessMessage } from "../utils/successMessage.js";
import { getCurrentRoleFromStorage } from "../utils/currentRole.js";

export default function Notes() {
  const [items, setItems] = useState([]);
  const [appts, setAppts] = useState([]);
  const [patients, setPatients] = useState([]);

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  // Crear / editar nota
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [patient_id, setPatientId] = useState("");
  const [appointment_id, setAppointmentId] = useState("");
  const [note_type, setType] = useState("soap");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [content, setContent] = useState("");

  // Modal de notas por paciente
  const [openPatient, setOpenPatient] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientNotes, setPatientNotes] = useState([]);
  const [loadingPatientNotes, setLoadingPatientNotes] = useState(false);
  const [searchPatientNotes, setSearchPatientNotes] = useState("");

  // Buscador principal
  const [search, setSearch] = useState("");

  const currentRole = getCurrentRoleFromStorage();

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

  const patientAppointments = useMemo(() => {
    if (!patient_id) return [];
    return appts
      .filter((a) => Number(a.patient_id) === Number(patient_id))
      .sort((a, b) => {
        const ta = a?.start_time ? dayjs(a.start_time).valueOf() : 0;
        const tb = b?.start_time ? dayjs(b.start_time).valueOf() : 0;
        return tb - ta;
      });
  }, [appts, patient_id]);

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
    if (!a) return "Sin cita";
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

  function resetForm() {
    setEditingNoteId(null);
    setPatientId("");
    setAppointmentId("");
    setType("soap");
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setContent("");
  }

  function closeNoteModal() {
    setOpen(false);
    resetForm();
  }

  function startEditNote(note) {
    setEditingNoteId(note.id);
    setPatientId(note.patient_id ? String(note.patient_id) : "");
    setAppointmentId(note.appointment_id ? String(note.appointment_id) : "");
    setType(note.note_type || "soap");
    setSubjective(note.subjective || "");
    setObjective(note.objective || "");
    setAssessment(note.assessment || "");
    setPlan(note.plan || "");
    setContent(note.content || "");
    setOpen(true);
  }

  async function createOrUpdate() {
    try {
      if (!patient_id) {
        setToast({ show: true, type: "Advertencia", message: "Selecciona un paciente" });
        return;
      }

      const payload = {
        patient_id: Number(patient_id),
        appointment_id: appointment_id ? Number(appointment_id) : null,
        note_type,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        content: content || null,
      };

      if (editingNoteId) {
        await NotesAPI.update(editingNoteId, payload);

        setToast({
          show: true,
          type: "Éxito",
          message: buildSuccessMessage(currentRole, "Nota actualizada"),
        });
      } else {
        await NotesAPI.create(payload);

        setToast({
          show: true,
          type: "Éxito",
          message: buildSuccessMessage(currentRole, "Nota creada"),
        });
      }

      closeNoteModal();
      await load();

      if (openPatient && selectedPatientId) {
        await openPatientNotes(selectedPatientId, { keepOpen: true });
      }
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message:
          e?.response?.data?.detail ||
          (editingNoteId ? "Error actualizando nota" : "Error creando nota"),
      });
    }
  }

  async function openPatientNotes(patientId, opts = {}) {
    const id = Number(patientId);
    if (!id) return;

    try {
      setSelectedPatientId(id);
      setLoadingPatientNotes(true);

      const data = await NotesAPI.byPatient(id);
      setPatientNotes(Array.isArray(data) ? data : []);

      setOpenPatient(true);

      if (!opts.keepOpen) {
        setSearchPatientNotes("");
      }
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

  const patientGroups = useMemo(() => {
    const groups = new Map();

    for (const n of items || []) {
      const pid = n.patient_id;
      if (!pid) continue;

      if (!groups.has(pid)) {
        groups.set(pid, {
          patient_id: pid,
          patient_name: patientNameById(pid),
          notes: [],
          last_note_at: null,
        });
      }

      const group = groups.get(pid);
      group.notes.push(n);

      const created = n?.created_at ? dayjs(n.created_at).valueOf() : 0;
      const currentLast = group.last_note_at ? dayjs(group.last_note_at).valueOf() : 0;

      if (created > currentLast) {
        group.last_note_at = n.created_at;
      }
    }

    let arr = Array.from(groups.values());

    const q = (search || "").toLowerCase().trim();
    if (q) {
      arr = arr.filter((g) => {
        const latest = g.last_note_at ? dayjs(g.last_note_at).format("YYYY-MM-DD HH:mm") : "";
        const previewText = g.notes
          .map((n) =>
            `${n.subjective || ""} ${n.objective || ""} ${n.assessment || ""} ${n.plan || ""} ${n.content || ""}`
          )
          .join(" ")
          .toLowerCase();

        const hay = `${g.patient_name} ${latest} ${previewText}`.toLowerCase();
        return hay.includes(q);
      });
    }

    arr.sort((a, b) => {
      const ta = a.last_note_at ? dayjs(a.last_note_at).valueOf() : 0;
      const tb = b.last_note_at ? dayjs(b.last_note_at).valueOf() : 0;
      return tb - ta;
    });

    return arr;
  }, [items, search, patients]);

  const patientNotesGrouped = useMemo(() => {
    const q = (searchPatientNotes || "").toLowerCase().trim();
    const arr = Array.isArray(patientNotes) ? [...patientNotes] : [];

    arr.sort((a, b) => {
      const aCreated = a?.created_at ? dayjs(a.created_at).valueOf() : 0;
      const bCreated = b?.created_at ? dayjs(b.created_at).valueOf() : 0;
      return bCreated - aCreated;
    });

    const filtered = !q
      ? arr
      : arr.filter((n) => {
          const a = apptMap.get(n.appointment_id);
          const when = a?.start_time ? dayjs(a.start_time).format("YYYY-MM-DD HH:mm") : "Sin cita";
          const created = n.created_at ? dayjs(n.created_at).format("YYYY-MM-DD HH:mm") : "";
          const type = labelNoteType(n.note_type);

          const hay =
            `${type} ${when} ${created} ${n.subjective || ""} ${n.objective || ""} ${n.assessment || ""} ${
              n.plan || ""
            } ${n.content || ""}`.toLowerCase();

          return hay.includes(q);
        });

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

  function pickDefaultAppointmentForPatient(patientId) {
    const id = Number(patientId);
    const patientAppts = appts
      .filter((a) => Number(a.patient_id) === id)
      .sort((a, b) => {
        const ta = a?.start_time ? dayjs(a.start_time).valueOf() : 0;
        const tb = b?.start_time ? dayjs(b.start_time).valueOf() : 0;
        return tb - ta;
      });

    const todayAppt = patientAppts.find((a) => isToday(a?.start_time));
    if (todayAppt) return todayAppt.id;

    if (patientAppts[0]) return patientAppts[0].id;

    return "";
  }

  function startNewNoteForPatient(patientIdValue) {
    const apptId = pickDefaultAppointmentForPatient(patientIdValue);
    resetForm();
    setPatientId(String(patientIdValue));
    setAppointmentId(apptId ? String(apptId) : "");
    setOpen(true);
  }

  return (
    <div className="grid">
      <div className="row">
        <div>
          <h1 className="h1">Notas clínicas</h1>
          <p className="p">Historial de notas agrupado por paciente.</p>
        </div>
        <div className="spacer" />
        <button
          className="btn btnPrimary"
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
        >
          + Nueva nota
        </button>
      </div>

      <div className="card cardPad" style={{ marginBottom: 12 }}>
        <label className="label">Buscar paciente o contenido</label>
        <input
          className="input"
          placeholder="Buscar por paciente, fecha o texto de notas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card cardPad" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Total notas</th>
              <th>Última nota</th>
              <th style={{ textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {patientGroups.map((g) => (
              <tr key={g.patient_id}>
                <td>{g.patient_name}</td>
                <td>{g.notes.length}</td>
                <td>{g.last_note_at ? dayjs(g.last_note_at).format("YYYY-MM-DD HH:mm") : "—"}</td>

                <td style={{ textAlign: "right" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <button className="btn" onClick={() => openPatientNotes(g.patient_id)}>
                      Ver notas
                    </button>
                    <button className="btn btnPrimary" onClick={() => startNewNoteForPatient(g.patient_id)}>
                      Nueva nota
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {patientGroups.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--muted)" }}>
                  Sin notas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editingNoteId ? "Editar nota clínica" : "Nueva nota clínica"}
        onClose={closeNoteModal}
        footer={
          <>
            <button className="btn" onClick={closeNoteModal}>
              Cancelar
            </button>
            <button className="btn btnPrimary" onClick={createOrUpdate}>
              {editingNoteId ? "Guardar cambios" : "Guardar"}
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <label className="label">Paciente</label>
          <select
            className="select"
            value={patient_id}
            onChange={(e) => {
              setPatientId(e.target.value);
              setAppointmentId("");
            }}
          >
            <option value="">Selecciona paciente…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id} — {p.full_name || p.name}
              </option>
            ))}
          </select>

          <label className="label">Cita (opcional)</label>
          <select
            className="select"
            value={appointment_id}
            onChange={(e) => setAppointmentId(e.target.value)}
            disabled={!patient_id}
          >
            <option value="">Sin cita / nota libre</option>
            {patientAppointments.map((a) => {
              const when = a.start_time ? dayjs(a.start_time).format("YYYY-MM-DD HH:mm") : `#${a.id}`;
              return (
                <option key={a.id} value={a.id}>
                  #{a.id} — {when} — {a.status}
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
        </div>
      </Modal>

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
              <button
                className="btn btnPrimary"
                onClick={() => startNewNoteForPatient(selectedPatientId)}
              >
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
          Se agrupan por día y pueden existir con o sin cita.
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
              <div
                key={g.date}
                className="card cardPad"
                style={{ background: "rgba(255,255,255,.03)" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
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
                    const when = a?.start_time ? dayjs(a.start_time).format("HH:mm") : "Sin cita";
                    const created = n.created_at ? dayjs(n.created_at).format("HH:mm") : "";

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
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>
                            #{n.id} — {labelNoteType(n.note_type)}
                          </div>
                          <div className="p" style={{ margin: 0, opacity: 0.8 }}>
                            {when} {created ? `• Creada ${created}` : ""}
                          </div>
                        </div>

                        {short ? (
                          <div className="p" style={{ marginTop: 8, wordBreak: "break-word" }}>
                            📝 {short}
                            {preview.length > 140 ? "..." : ""}
                          </div>
                        ) : (
                          <div className="p" style={{ marginTop: 8, color: "var(--muted)" }}>
                            (Nota sin contenido visible)
                          </div>
                        )}

                        <div style={{ marginTop: 10 }}>
                          <button className="btn" onClick={() => startEditNote(n)}>
                            Editar nota
                          </button>
                        </div>
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