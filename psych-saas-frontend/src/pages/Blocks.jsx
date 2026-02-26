import { useEffect, useState } from "react";
import dayjs from "dayjs";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { BlocksAPI } from "../api/blocks";

export default function Blocks() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "info", message: "" });

  // ✅ Modo: crear vs editar
  const [editingId, setEditingId] = useState(null);

  const [start_time, setStart] = useState(""); // datetime-local
  const [end_time, setEnd] = useState("");     // datetime-local
  const [reason, setReason] = useState("");

  async function load() {
    const data = await BlocksAPI.list();
    setItems(data || []);
  }

  useEffect(() => { load(); }, []);

  // ✅ Convierte datetime-local -> string "naive" (SIN Z)
  // Ej: "2026-02-11T12:00" -> "2026-02-11T12:00:00"
  function toNaiveLocalDatetimeString(dtLocalValue) {
    if (!dtLocalValue) return "";
    return dayjs(dtLocalValue).format("YYYY-MM-DDTHH:mm:ss");
  }

  function resetForm() {
    setEditingId(null);
    setStart("");
    setEnd("");
    setReason("");
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  function openEdit(block) {
    // Rellenar inputs datetime-local (acepta "YYYY-MM-DDTHH:mm")
    const s = block?.start_time ? dayjs(block.start_time).format("YYYY-MM-DDTHH:mm") : "";
    const e = block?.end_time ? dayjs(block.end_time).format("YYYY-MM-DDTHH:mm") : "";

    setEditingId(block.id);
    setStart(s);
    setEnd(e);
    setReason(block.reason || "");
    setOpen(true);
  }

  async function save() {
    try {
      if (!start_time || !end_time) {
        setToast({ show: true, type: "Advertencia", message: "Selecciona inicio y fin" });
        return;
      }

      // ✅ IMPORTANTE: NO usar toISOString() (evita cambiar horario a UTC)
      const payload = {
        start_time: toNaiveLocalDatetimeString(start_time),
        end_time: toNaiveLocalDatetimeString(end_time),
        reason: reason || null
      };

      if (editingId) {
        await BlocksAPI.update(editingId, payload);
        setToast({ show: true, type: "Éxito", message: "Bloqueo actualizado" });
      } else {
        await BlocksAPI.create(payload);
        setToast({ show: true, type: "Éxito", message: "Bloqueo creado" });
      }

      setOpen(false);
      resetForm();
      await load();
    } catch (e) {
      setToast({
        show: true,
        type: "Advertencia",
        message: e?.response?.data?.detail || "Error guardando bloqueo"
      });
    }
  }

  async function remove(id) {
    // Esto es el "desbloquear"
    if (!confirm("¿Desbloquear (desactivar) este bloqueo?")) return;
    try {
      await BlocksAPI.remove(id);
      setToast({ show: true, type: "success", message: "Bloqueo desactivado (desbloqueado)" });
      await load();
    } catch (e) {
      setToast({ show: true, type: "Advertencia", message: e?.response?.data?.detail || "Error" });
    }
  }

  return (
    <div className="grid">
      <div className="row">
        <div>
          <h1 className="h1">Bloqueos</h1>
          <p className="p">Bloquea agenda (vacaciones, juntas, etc.).</p>
        </div>
        <div className="spacer" />
        <button className="btn btnPrimary" onClick={openCreate}>
          + Nuevo bloqueo
        </button>
      </div>

      <div className="card cardPad">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td>#{b.id}</td>
                <td>{b.start_time ? dayjs(b.start_time).format("YYYY-MM-DD HH:mm") : "—"}</td>
                <td>{b.end_time ? dayjs(b.end_time).format("YYYY-MM-DD HH:mm") : "—"}</td>
                <td>{b.reason || "—"}</td>

                <td style={{ textAlign: "right" }}>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button className="btn" onClick={() => openEdit(b)}>
                      Editar
                    </button>
                    <button className="btn btnDanger" onClick={() => remove(b.id)}>
                      Desbloquear
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)" }}>
                  Sin bloqueos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editingId ? `Editar bloqueo #${editingId}` : "Crear bloqueo"}
        onClose={() => { setOpen(false); resetForm(); }}
        footer={
          <>
            <button className="btn" onClick={() => { setOpen(false); resetForm(); }}>
              Cancelar
            </button>
            <button className="btn btnPrimary" onClick={save}>
              {editingId ? "Guardar cambios" : "Crear"}
            </button>
          </>
        }
      >
        <label className="label">Inicio (local)</label>
        <input
          className="input"
          type="datetime-local"
          value={start_time}
          onChange={(e) => setStart(e.target.value)}
        />

        <label className="label">Fin (local)</label>
        <input
          className="input"
          type="datetime-local"
          value={end_time}
          onChange={(e) => setEnd(e.target.value)}
        />

        <label className="label">Motivo</label>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Vacaciones, junta, día personal..."
        />
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