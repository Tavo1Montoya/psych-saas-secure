import { useEffect, useMemo, useState } from "react";
import { PatientsAPI } from "../api/patients";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { prettyApiError } from "../utils/error";
import dayjs from "dayjs";

export default function Patients() {
  const [items, setItems] = useState([]);

  // Modal nuevo paciente
  const [open, setOpen] = useState(false);

  // Modal ficha identificación
  const [openFicha, setOpenFicha] = useState(false);
  const [selected, setSelected] = useState(null); // paciente seleccionado (obj)

  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  // ✅ Campos acorde a tu backend (PatientCreate)
  const [full_name, setFullName] = useState("");
  const [age, setAge] = useState(""); // string en input, convertimos a number si aplica
  const [phone, setPhone] = useState("");
  const [birth_date, setBirthDate] = useState(""); // YYYY-MM-DD

  // ✅ NUEVO: tel emergencia (para tabla y ficha)
  const [emergency_phone, setEmergencyPhone] = useState("");

  // ✅ Ficha: estado del formulario (editable)
  const [ficha, setFicha] = useState({
    full_name: "",
    sex: "",
    age: "",
    marital_status: "",
    occupation: "",
    workplace: "",
    work_days: "",
    work_schedule: "",
    birth_date: "",
    birth_place: "",
    education: "",
    religion: "",
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [savingFicha, setSavingFicha] = useState(false);

  async function load() {
    const data = await PatientsAPI.list();
    setItems(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  function formatBirthDate(value) {
    if (!value) return "—";
    const d = dayjs(value);
    return d.isValid() ? d.format("YYYY-MM-DD") : String(value);
  }

  // =========================
  // Crear paciente (modal Nuevo)
  // =========================
  async function create() {
    try {
      const name = full_name.trim();
      if (!name) {
        setToast({ show: true, type: "error", message: "El nombre es obligatorio." });
        return;
      }

      const hasBirthDate = Boolean(birth_date);
      const hasAge = age !== "" && !Number.isNaN(Number(age));

      if (!hasAge && !hasBirthDate) {
        setToast({
          show: true,
          type: "error",
          message: "Debes capturar Edad o Fecha de nacimiento.",
        });
        return;
      }

      const payload = {
        full_name: name,
        phone: phone.trim() || undefined,
        birth_date: hasBirthDate ? birth_date : undefined, // "YYYY-MM-DD"
        emergency_contact_phone: emergency_phone.trim() || undefined, // ✅ nuevo
        ...(hasAge ? { age: Number(age) } : {}),
      };

      await PatientsAPI.create(payload);

      setToast({ show: true, type: "Éxito", message: "Paciente creado" });
      setOpen(false);

      setFullName("");
      setAge("");
      setPhone("");
      setBirthDate("");
      setEmergencyPhone("");

      await load();
    } catch (e) {
      setToast({ show: true, type: "error", message: prettyApiError(e) });
    }
  }

  async function remove(id) {
    if (!confirm("¿Eliminar (desactivar) paciente?")) return;
    try {
      await PatientsAPI.remove(id);
      setToast({ show: true, type: "Éxito", message: "Paciente Eliminado" });
      await load();
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error eliminando",
      });
    }
  }

  // =========================
  // Abrir ficha (click nombre)
  // =========================
  function openFichaForPatient(p) {
    setSelected(p);

    // ✅ precargar ficha con lo que venga del backend
    setFicha({
      full_name: p?.full_name || p?.name || "",
      sex: p?.sex || "",
      age: p?.age != null ? String(p.age) : "",
      marital_status: p?.marital_status || "",
      occupation: p?.occupation || "",
      workplace: p?.workplace || "",
      work_days: p?.work_days || "",
      work_schedule: p?.work_schedule || "",
      birth_date: p?.birth_date ? formatBirthDate(p.birth_date) : "",
      birth_place: p?.birth_place || "",
      education: p?.education || "",
      religion: p?.religion || "",
      phone: p?.phone || "",
      address: p?.address || "",
      emergency_contact_name: p?.emergency_contact_name || "",
      emergency_contact_phone: p?.emergency_contact_phone || "",
    });

    setOpenFicha(true);
  }

  // =========================
  // Guardar ficha (PUT)
  // =========================
  async function saveFicha() {
    try {
      if (!selected?.id) return;

      setSavingFicha(true);

      // ✅ payload limpio: manda solo lo necesario
      const payload = {
        full_name: ficha.full_name?.trim() || undefined,
        phone: ficha.phone?.trim() || undefined,
        address: ficha.address?.trim() || undefined,

        sex: ficha.sex?.trim() || undefined,
        marital_status: ficha.marital_status?.trim() || undefined,
        occupation: ficha.occupation?.trim() || undefined,
        workplace: ficha.workplace?.trim() || undefined,
        work_days: ficha.work_days?.trim() || undefined,
        work_schedule: ficha.work_schedule?.trim() || undefined,

        birth_place: ficha.birth_place?.trim() || undefined,
        education: ficha.education?.trim() || undefined,
        religion: ficha.religion?.trim() || undefined,

        emergency_contact_name: ficha.emergency_contact_name?.trim() || undefined,
        emergency_contact_phone: ficha.emergency_contact_phone?.trim() || undefined,
      };

      // ✅ birth_date (si viene)
      if (ficha.birth_date) payload.birth_date = ficha.birth_date;

      // ✅ age (si viene num)
      if (ficha.age !== "" && !Number.isNaN(Number(ficha.age))) {
        payload.age = Number(ficha.age);
      }

      await PatientsAPI.update(selected.id, payload);

      setToast({ show: true, type: "Éxito", message: "Ficha guardada correctamente" });
      setOpenFicha(false);
      setSelected(null);

      await load();
    } catch (e) {
      setToast({ show: true, type: "error", message: prettyApiError(e) });
    } finally {
      setSavingFicha(false);
    }
  }

  const tableRows = useMemo(() => items || [], [items]);

  return (
    <div className="grid">
      {/* Header */}
      <div className="row pageHeader">
        <div>
          <h1 className="h1">Pacientes</h1>
          <p className="p">Gestión de pacientes del consultorio.</p>
        </div>
        <div className="spacer" />
        <button className="btn btnPrimary btnInline" onClick={() => setOpen(true)}>
          + Nuevo
        </button>
      </div>

      {/* Tabla (solo columnas pedidas) */}
      <div className="card cardPad">
        <div className="tableWrap">
          <table className="table patientsTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Tel. emergencia</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {tableRows.map((p) => (
                <tr key={p.id}>
                  <td>#{p.id}</td>

                  {/* ✅ Click abre ficha */}
                  <td>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        padding: "6px 10px",
                        background: "transparent",
                        border: "1px solid var(--border)",
                      }}
                      onClick={() => openFichaForPatient(p)}
                      title="Abrir ficha de identificación"
                    >
                      {p.full_name || p.name || "—"}
                    </button>
                  </td>

                  <td>{p.phone || "—"}</td>
                  <td>{p.emergency_contact_phone || "—"}</td>

                  <td style={{ textAlign: "right" }}>
                    <button className="btn btnDanger" onClick={() => remove(p.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    Sin pacientes aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo paciente */}
      <Modal
        open={open}
        title="Nuevo paciente"
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
        <label className="label">Nombre completo</label>
        <input className="input" value={full_name} onChange={(e) => setFullName(e.target.value)} />

        <label className="label">Edad (opcional si pones nacimiento)</label>
        <input
          className="input"
          type="number"
          min="0"
          max="120"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />

        <label className="label">Teléfono</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <label className="label">Fecha de nacimiento (opcional si pones edad)</label>
        <input
          className="input"
          type="date"
          value={birth_date}
          onChange={(e) => setBirthDate(e.target.value)}
        />

        <label className="label">Teléfono de emergencia</label>
        <input
          className="input"
          value={emergency_phone}
          onChange={(e) => setEmergencyPhone(e.target.value)}
          placeholder="Ej: 4490000000"
        />
      </Modal>

      {/* ✅ Modal Ficha de identificación (editable + guardar) */}
      <Modal
        open={openFicha}
        title="Ficha de identificación"
        onClose={() => {
          if (savingFicha) return;
          setOpenFicha(false);
          setSelected(null);
        }}
        footer={
          <>
            <button
              className="btn"
              onClick={() => {
                if (savingFicha) return;
                setOpenFicha(false);
                setSelected(null);
              }}
            >
              Cerrar
            </button>
            <button className="btn btnPrimary" onClick={saveFicha} disabled={savingFicha}>
              {savingFicha ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        {/* ✅ Form de ficha (respetando tu look, sin inventar CSS nuevo) */}
        <div className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={ficha.full_name}
                onChange={(e) => setFicha({ ...ficha, full_name: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 140 }}>
              <label className="label">Sexo</label>
              <input
                className="input"
                value={ficha.sex}
                onChange={(e) => setFicha({ ...ficha, sex: e.target.value })}
                placeholder="F/M"
              />
            </div>

            <div style={{ minWidth: 140 }}>
              <label className="label">Edad</label>
              <input
                className="input"
                type="number"
                value={ficha.age}
                onChange={(e) => setFicha({ ...ficha, age: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Estado civil</label>
              <input
                className="input"
                value={ficha.marital_status}
                onChange={(e) => setFicha({ ...ficha, marital_status: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Religión</label>
              <input
                className="input"
                value={ficha.religion}
                onChange={(e) => setFicha({ ...ficha, religion: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Escolaridad</label>
              <input
                className="input"
                value={ficha.education}
                onChange={(e) => setFicha({ ...ficha, education: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Ocupación</label>
              <input
                className="input"
                value={ficha.occupation}
                onChange={(e) => setFicha({ ...ficha, occupation: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Lugar de trabajo</label>
              <input
                className="input"
                value={ficha.workplace}
                onChange={(e) => setFicha({ ...ficha, workplace: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Días laborales</label>
              <input
                className="input"
                value={ficha.work_days}
                onChange={(e) => setFicha({ ...ficha, work_days: e.target.value })}
                placeholder="Ej: L-V"
              />
            </div>

            <div style={{ minWidth: 220, flex: 1 }}>
              <label className="label">Horario laboral</label>
              <input
                className="input"
                value={ficha.work_schedule}
                onChange={(e) => setFicha({ ...ficha, work_schedule: e.target.value })}
                placeholder="Ej: 9am - 6pm"
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <label className="label">Fecha de nacimiento</label>
              <input
                className="input"
                type="date"
                value={ficha.birth_date || ""}
                onChange={(e) => setFicha({ ...ficha, birth_date: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 260, flex: 1 }}>
              <label className="label">Lugar de nacimiento</label>
              <input
                className="input"
                value={ficha.birth_place}
                onChange={(e) => setFicha({ ...ficha, birth_place: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220 }}>
              <label className="label">Celular</label>
              <input
                className="input"
                value={ficha.phone}
                onChange={(e) => setFicha({ ...ficha, phone: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 260, flex: 1 }}>
              <label className="label">Domicilio</label>
              <input
                className="input"
                value={ficha.address}
                onChange={(e) => setFicha({ ...ficha, address: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 260, flex: 1 }}>
              <label className="label">Contacto de emergencia</label>
              <input
                className="input"
                value={ficha.emergency_contact_name}
                onChange={(e) => setFicha({ ...ficha, emergency_contact_name: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 220 }}>
              <label className="label">Tel. emergencia</label>
              <input
                className="input"
                value={ficha.emergency_contact_phone}
                onChange={(e) =>
                  setFicha({ ...ficha, emergency_contact_phone: e.target.value })
                }
              />
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