// src/api/patients.js
import api from "./axios";

/**
 * Limpia el payload:
 * - quita undefined/null
 * - quita strings vacíos ""
 */
function cleanPayload(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Convierte Date -> "YYYY-MM-DD"
 */
function toYMD(value) {
  if (!value) return value;

  // Si ya viene como "YYYY-MM-DD" o ISO, lo dejamos
  if (typeof value === "string") {
    // corta a 10 por si viene ISO: "2026-12-13T00:00:00Z"
    return value.length >= 10 ? value.slice(0, 10) : value;
  }

  // Si viene Date
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return value;
}

/**
 * Normaliza cualquier payload para que SIEMPRE termine en el formato del backend (snake_case).
 * Acepta aliases en español por compatibilidad:
 * - nombre -> full_name
 * - edad -> age
 * - telefono -> phone
 * - fecha_nacimiento -> birth_date
 */
function normalizePatientPayload(payload = {}) {
  const p = { ...payload };

  // =========================
  // Alias español -> backend
  // =========================
  if (p.full_name === undefined && p.nombre !== undefined) p.full_name = p.nombre;
  if (p.age === undefined && p.edad !== undefined) p.age = p.edad;
  if (p.phone === undefined && p.telefono !== undefined) p.phone = p.telefono;
  if (p.birth_date === undefined && p.fecha_nacimiento !== undefined) p.birth_date = p.fecha_nacimiento;

  // =========================
  // Tipos correctos
  // =========================
  if (p.age !== undefined && p.age !== null && p.age !== "") {
    const n = Number(p.age);
    if (!Number.isNaN(n)) p.age = n;
  }

  if (p.birth_date !== undefined) {
    p.birth_date = toYMD(p.birth_date);
  }

  // =========================
  // Campos de ficha (backend snake_case)
  // (si vienen en payload, se respetan)
  // =========================
  // sex, marital_status, occupation, workplace, work_days, work_schedule,
  // birth_place, education, religion, address,
  // emergency_contact_name, emergency_contact_phone, notes

  return cleanPayload(p);
}

export const PatientsAPI = {
  // Lista pacientes
  list: () => api.get("/patients/").then((r) => r.data),

  // Obtiene 1 paciente
  get: (id) => api.get(`/patients/${id}`).then((r) => r.data),

  // Crea paciente
  create: (payload) =>
    api.post("/patients/", normalizePatientPayload(payload)).then((r) => r.data),

  // Actualiza paciente
  update: (id, payload) =>
    api.put(`/patients/${id}`, normalizePatientPayload(payload)).then((r) => r.data),

  // Elimina (soft delete)
  remove: (id) => api.delete(`/patients/${id}`).then((r) => r.data),
};

export default PatientsAPI;