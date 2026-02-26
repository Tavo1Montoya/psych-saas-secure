// src/auth/RequireRole.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireRole({ allowedRoles = [] }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // ✅ Si todavía no hay role, espera (evita loops)
  if (!role) return <div style={{ padding: 20 }}>Cargando permisos...</div>;

  // ✅ Si no tiene permiso, redirige según rol
  if (!allowedRoles.includes(role)) {
    const fallback = role === "assistant" ? "/patients" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}