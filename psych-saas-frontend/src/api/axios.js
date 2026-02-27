// src/api/axios.js
import axios from "axios";

/**
 * 1) Lee VITE_API_URL desde Railway.
 * 2) Si no existe, usa localhost:8000 para desarrollo local.
 */
let API_URL = import.meta.env.VITE_API_URL?.trim() || "http://localhost:8000";

// ✅ MEJORA: Solo forzamos http si es localhost. 
// Para Railway, dejamos que use el protocolo que viene en la variable (que es https).
if (!/^https?:\/\//i.test(API_URL)) {
  const protocol = API_URL.includes("localhost") ? "http://" : "https://";
  API_URL = `${protocol}${API_URL}`;
}

API_URL = API_URL.replace(/\/+$/, ""); // quita slash(es) al final

const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: false, 
});

// ✅ Request interceptor: agrega token si existe
api.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {};

    const token =
      localStorage.getItem("token") || localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response interceptor: manejo de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;