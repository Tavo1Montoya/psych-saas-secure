import api from "./axios";

export const BlocksAPI = {
  list: () => api.get("/appointments/blocks/").then(r => r.data),
  create: (payload) => api.post("/appointments/blocks/", payload).then(r => r.data),
  update: (id, payload) => api.put(`/appointments/blocks/${id}`, payload).then(r => r.data),
  remove: (id) => api.delete(`/appointments/blocks/${id}`).then(r => r.data),
};