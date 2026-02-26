import api from "./axios";

export const AppointmentsAPI = {
  list: (params) => api.get("/appointments/", { params }).then(r => r.data),
  create: (payload) => api.post("/appointments/", payload).then(r => r.data),
  update: (id, payload) => api.put(`/appointments/${id}`, payload).then(r => r.data),
  cancel: (id) => api.delete(`/appointments/${id}`).then(r => r.data),

  complete: (id) => api.put(`/appointments/${id}/complete`).then(r => r.data),
  noShow: (id) => api.put(`/appointments/${id}/no-show`).then(r => r.data),

  availability: (params) => api.get("/appointments/availability", { params }).then(r => r.data),
};