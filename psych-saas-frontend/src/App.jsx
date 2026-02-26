// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./auth/ProtectedRoute";
import RequireRole from "./auth/RequireRole";
import AppLayout from "./layouts/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import Notes from "./pages/Notes";
import Blocks from "./pages/Blocks";

import { useAuth } from "./auth/useAuth";
import "./styles/global.css";

// ✅ Redirect inicial por rol (assistant -> patients, demás -> dashboard)
function RoleIndexRedirect() {
  const { role } = useAuth();

  if (!role) return <div style={{ padding: 20 }}>Cargando permisos...</div>;

  const to = role === "assistant" ? "/patients" : "/dashboard";
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path="/login" element={<Login />} />

      {/* Privado: necesita login */}
      <Route element={<ProtectedRoute />}>
        {/* Layout privado */}
        <Route element={<AppLayout />}>
          {/* ✅ IMPORTANTE: ya NO mandamos fijo a /dashboard */}
          <Route index element={<RoleIndexRedirect />} />

          {/* ✅ Dashboard SOLO admin + psychologist (assistant NO) */}
          <Route element={<RequireRole allowedRoles={["admin", "psychologist"]} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          {/* ✅ Módulos permitidos para assistant + psychologist + admin */}
          <Route element={<RequireRole allowedRoles={["admin", "psychologist", "assistant"]} />}>
            <Route path="/patients" element={<Patients />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/blocks" element={<Blocks />} />
          </Route>

          {/* ✅ Notas: SOLO psychologist + admin */}
          <Route element={<RequireRole allowedRoles={["admin", "psychologist"]} />}>
            <Route path="/notes" element={<Notes />} />
          </Route>
        </Route>
      </Route>

      {/* Fallbacks */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}