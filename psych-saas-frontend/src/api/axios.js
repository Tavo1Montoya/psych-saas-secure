// src/api/axios.js
import axios from "axios";

/**
 * 1) Lee VITE_API_URL si existe.
 * 2) Si no existe, usa localhost:8000
 * 3) Normaliza:
 *    - Si viene sin "http", lo agrega.
 *    - Quita "/" final para evitar dobles // en rutas.
 */
let API_URL = import.meta.env.VITE_API_URL?.trim() || "http://localhost:8000";

if (!/^https?:\/\//i.test(API_URL)) {
  API_URL = `http://${API_URL}`;
}

API_URL = API_URL.replace(/\/+$/, ""); // quita slash(es) al final

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: false, // correcto si NO estás usando cookies
});

// ✅ Request interceptor: agrega token si existe
api.interceptors.request.use(
  (config) => {
    // Asegura headers (por seguridad)
    config.headers = config.headers ?? {};

    const token =
      localStorage.getItem("token") || localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // si no hay token, no forces Authorization viejo
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response interceptor: si token expira => logout suave (sin loop)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      // Evita loop si ya estás en /login
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;