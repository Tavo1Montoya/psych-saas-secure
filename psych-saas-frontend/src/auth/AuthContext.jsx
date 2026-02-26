// src/auth/AuthContext.jsx
import { useMemo, useState } from "react";
import { AuthContext } from "./authContext";

import { loginRequest } from "../api/auth";
import { getToken, setToken, clearToken } from "../utils/token";

// ✅ Decodifica JWT sin librerías (safe)
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// ✅ Intenta encontrar el role en el token con varias llaves comunes
function getRoleFromToken(token) {
  const payload = parseJwt(token);
  if (!payload) return "";

  return (
    payload.role ||
    payload.user_role ||
    payload.rol ||
    payload.user?.role ||
    ""
  );
}

export function AuthProvider({ children }) {
  const [tokenState, setTokenState] = useState(() => getToken());

  const isAuthenticated = !!tokenState;

  // ✅ role inicial: primero localStorage, si no existe => intenta del token
  const [role, setRole] = useState(() => {
    const saved = localStorage.getItem("role");
    if (saved) return saved;

    const tk = getToken();
    if (tk) return getRoleFromToken(tk);

    return "";
  });

  async function login(email, password) {
    const data = await loginRequest(email, password);

    const token = data.access_token || data.token;
    if (!token) throw new Error("Login response did not include token");

    setToken(token);
    setTokenState(token);

    // ✅ 1) si backend manda role úsalo
    // ✅ 2) si NO manda, intenta obtenerlo del JWT
    const userRole =
      data.role || data.user?.role || getRoleFromToken(token) || "";

    if (userRole) {
      setRole(userRole);
      localStorage.setItem("role", userRole);
    } else {
      // Si sigue vacío, deja un log para que sepamos
      console.warn("⚠️ No role found in login response nor token payload.");
      setRole("");
      localStorage.removeItem("role");
    }

    return data;
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setRole("");
    localStorage.removeItem("role");
  }

  const value = useMemo(
    () => ({
      token: tokenState,
      isAuthenticated,
      role,
      login,
      logout,
    }),
    [tokenState, isAuthenticated, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}