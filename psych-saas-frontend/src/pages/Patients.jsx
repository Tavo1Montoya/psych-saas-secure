import { useEffect, useMemo, useState } from "react";
import { PatientsAPI } from "../api/patients";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { prettyApiError } from "../utils/error";
import dayjs from "dayjs";
import { buildSuccessMessage } from "../utils/successMessage.js";
import { getCurrentRoleFromStorage } from "../utils/currentRole.js";

export default function Patients() {
  
  const [items, setItems] = useState([]);
    // Modal nuevo paciente
  const [open, setOpen] = useState(false);

  // Modal ficha identificación
  const [openFicha, setOpenFicha] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("")

  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  
  // ✅ Campos modal nuevo paciente
  const [full_name, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [birth_date, setBirthDate] = useState("");

  // ✅ NUEVOS
  const [expediente_number, setExpedienteNumber] = useState("");
  const [alias, setAlias] = useState("");

  // ✅ Tel emergencia
  const [emergency_phone, setEmergencyPhone] = useState("");

  // ✅ Ficha editable
  const [ficha, setFicha] = useState({
    alias: "",
    full_name: "",
    expediente_number: "",
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
  const currentRole = getCurrentRoleFromStorage();
  

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
  // Crear paciente
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
        birth_date: hasBirthDate ? birth_date : undefined,
        emergency_contact_phone: emergency_phone.trim() || undefined,

        // ✅ NUEVOS
        expediente_number: expediente_number.trim() || undefined,
        alias: alias.trim() || undefined,

        ...(hasAge ? { age: Number(age) } : {}),
      };

      await PatientsAPI.create(payload);

      setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Paciente creado"),
});
      setOpen(false);

      setFullName("");
      setAge("");
      setPhone("");
      setBirthDate("");
      setEmergencyPhone("");
      setExpedienteNumber("");
      setAlias("");

      await load();
    } catch (e) {
      setToast({ show: true, type: "error", message: prettyApiError(e) });
    }
  }

  async function remove(id) {
    if (!confirm("¿Eliminar (desactivar) paciente?")) return;
    try {
      await PatientsAPI.remove(id);
      setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Paciente eliminado"),
});
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
  // Abrir ficha
  // =========================
  function openFichaForPatient(p) {
    setSelected(p);

    setFicha({
      alias: p?.alias || "",
      full_name: p?.full_name || p?.name || "",
      expediente_number: p?.expediente_number || "",
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
  // Guardar ficha
  // =========================
  async function saveFicha() {
    try {
      if (!selected?.id) return;

      setSavingFicha(true);

      const payload = {
        expediente_number: ficha.expediente_number?.trim() || undefined,
        alias: ficha.alias?.trim() || undefined,
        full_name: ficha.full_name?.trim() || undefined,
        phone: ficha.phone?.trim() || undefined,
        address: ficha.address?.trim() || undefined,

        // ✅ NUEVOS
        
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

      if (ficha.birth_date) payload.birth_date = ficha.birth_date;

      if (ficha.age !== "" && !Number.isNaN(Number(ficha.age))) {
        payload.age = Number(ficha.age);
      }

      await PatientsAPI.update(selected.id, payload);

      setToast({
  show: true,
  type: "Éxito",
  message: buildSuccessMessage(currentRole, "Ficha guardada correctamente"),
});
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
const totalPatients = tableRows.length;

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

      {/* Resumen rápido */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <div className="card cardPad" style={{ minHeight: 92 }}>
          <div className="label" style={{ marginTop: 0 }}>
            Pacientes registrados
          </div>

          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              lineHeight: 1.1,
              color: "var(--text)",
            }}
          >
            {totalPatients}
          </div>

          <div className="p" style={{ marginTop: 6 }}>
            Total activo en el consultorio
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card cardPad">
        <div className="tableWrap">
          <table className="table patientsTable">
            <thead>
              <div className="search-container">
  <input
    type="text"
    placeholder="🔍 Buscar por alias..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="search-input"
  />
</div>
              <tr>
                <th>Alias</th>
                <th>N° Expediente</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Tel. emergencia</th>
                <th></th>
              </tr>
            </thead>
             
            <tbody>
              
              {tableRows
                  .filter((p) =>
                  (p.full_name || "")
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                  (p.alias || "")
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .map((p) => (
                   <tr key={p.id}>
                  <td>{p.alias || "—"}</td>
                  <td>{p.expediente_number || "—"}</td>

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
                  <td colSpan={6} style={{ color: "var(--muted)" }}>
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

        {/* ✅ NUEVO */}
        <label className="label">N° Expediente</label>
        <input
          className="input"
          value={expediente_number}
          onChange={(e) => setExpedienteNumber(e.target.value)}
          placeholder="Ej: EXP-001"
        />

        {/* ✅ NUEVO */}
        <label className="label">Alias</label>
        <input
          className="input"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Ej: Juanito"
        />

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

      {/* Modal Ficha */}
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
        <div className="grid" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={ficha.full_name}
                onChange={(e) => setFicha({ ...ficha, full_name: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 180 }}>
              <label className="label">N° Expediente</label>
              <input
                className="input"
                value={ficha.expediente_number}
                onChange={(e) => setFicha({ ...ficha, expediente_number: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 180 }}>
              <label className="label">Alias</label>
              <input
                className="input"
                value={ficha.alias}
                onChange={(e) => setFicha({ ...ficha, alias: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
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

            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Estado civil</label>
              <input
                className="input"
                value={ficha.marital_status}
                onChange={(e) => setFicha({ ...ficha, marital_status: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Religión</label>
              <input
                className="input"
                value={ficha.religion}
                onChange={(e) => setFicha({ ...ficha, religion: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Escolaridad</label>
              <input
                className="input"
                value={ficha.education}
                onChange={(e) => setFicha({ ...ficha, education: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
           <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Ocupación</label>
              <input
                className="input"
                value={ficha.occupation}
                onChange={(e) => setFicha({ ...ficha, occupation: e.target.value })}
              />
            </div>

           <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Lugar de trabajo</label>
              <input
                className="input"
                value={ficha.workplace}
                onChange={(e) => setFicha({ ...ficha, workplace: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Días laborales</label>
              <input
                className="input"
                value={ficha.work_days}
                onChange={(e) => setFicha({ ...ficha, work_days: e.target.value })}
                placeholder="Ej: L-V"
              />
            </div>

            <div style={{ minWidth: 180, flex: "1 1 180px" }}>
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
           <div style={{ minWidth: 180, flex: "1 1 180px" }}>
              <label className="label">Fecha de nacimiento</label>
              <input
                className="input"
                type="date"
                value={ficha.birth_date || ""}
                onChange={(e) => setFicha({ ...ficha, birth_date: e.target.value })}
              />
            </div>

            <div style={{ minWidth: 220, flex: "1 1 220px" }}>
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

            <div style={{ minWidth: 220, flex: "1 1 220px" }}>
              <label className="label">Domicilio</label>
              <input
                className="input"
                value={ficha.address}
                onChange={(e) => setFicha({ ...ficha, address: e.target.value })}
              />
            </div>
          </div>

          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 220, flex: "1 1 220px" }}>
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