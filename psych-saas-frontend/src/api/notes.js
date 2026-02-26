// src/api/notes.js
import api from "./axios";

/**
 * Notes API
 * Compatible con backend FastAPI actual
 *
 * ✅ Ajustes seguros:
 * - Normaliza patientId/noteId a Number cuando aplica
 * - Mantiene exactamente los mismos métodos y exports compatibles
 */
export const NotesAPI = {
  /**
   * Listar todas las notas
   */
  list: async () => {
    const { data } = await api.get("/notes/");
    return data;
  },

  /**
   * Listar por paciente
   * @param {number|string} patientId - id del paciente
   */
  byPatient: async (patientId) => {
    const id = Number(patientId);
    const { data } = await api.get(`/notes/by-patient/${id}`);
    return data;
  },

  /**
   * Crear nota
   * @param {object} payload
   */
  create: async (payload) => {
    const { data } = await api.post("/notes/", payload);
    return data;
  },

  /**
   * Actualizar nota
   * @param {number|string} noteId
   * @param {object} payload
   */
  update: async (noteId, payload) => {
    const id = Number(noteId);
    const { data } = await api.put(`/notes/${id}`, payload);
    return data;
  },

  /**
   * Eliminar nota
   * @param {number|string} noteId
   */
  remove: async (noteId) => {
    const id = Number(noteId);
    const { data } = await api.delete(`/notes/${id}`);
    return data;
  },
};

// ✅ exports “compatibles” por si alguna página usa estos nombres
export const getNotesRequest = NotesAPI.list;
export const getNotesByPatientRequest = NotesAPI.byPatient;
export const createNoteRequest = NotesAPI.create;
export const updateNoteRequest = NotesAPI.update;
export const deleteNoteRequest = NotesAPI.remove;