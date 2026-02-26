import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, NotebookPen, Ban } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useEffect, useMemo, useState } from "react";

export default function AppLayout() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  // ✅ Sidebar en móvil (drawer)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function exit() {
    logout();
    navigate("/login");
  }

  const linkClass = ({ isActive }) => `sideItem ${isActive ? "sideActive" : ""}`;

  const roleLabel =
    role === "assistant" ? "Pita" :
    role === "psychologist" ? "Psicóloga" :
    role === "admin" ? "Admin" :
    role;

  const roleShort =
    role === "assistant" ? "Assist" :
    role === "psychologist" ? "Psic." :
    role === "admin" ? "Admin" :
    role;

  const menu = useMemo(() => ([
    ...(role !== "assistant"
      ? [{ to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> }]
      : []),

    { to: "/patients", label: "Pacientes", icon: <Users size={18} /> },
    { to: "/appointments", label: "Citas", icon: <Calendar size={18} /> },

    ...(role !== "assistant"
      ? [{ to: "/notes", label: "Notas", icon: <NotebookPen size={18} /> }]
      : []),

    { to: "/blocks", label: "Bloqueos", icon: <Ban size={18} /> },
  ]), [role]);

  // ✅ Cierra sidebar al cambiar de ruta (cuando das click a un link)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location?.pathname]); // si te marca error, bórralo y no pasa nada

  // ✅ Año automático
  const year = new Date().getFullYear();

  return (
    <div className="layout">
      {/* ✅ Overlay para móvil */}
      {sidebarOpen && <div className="sidebarOverlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "isOpen" : ""}`}>
        <div className="card cardPad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Psic. Karla Mora</div>
          <div className="p">Agenda Virtual</div>

          <div style={{ marginTop: 10 }}>
            <span className="badge badgeWarn">Rol: {roleShort}</span>
          </div>

          <div className="p" style={{ marginTop: 8 }}>
            Perfil: {roleLabel}
          </div>
        </div>

        <nav className="grid" style={{ gap: 8 }}>
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              onClick={() => setSidebarOpen(false)} // ✅ en móvil cierra al navegar
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 18 }}>
          <button className="btn btnDanger" onClick={exit} style={{ width: "100%" }}>
            Cerrar sesión
          </button>
        </div>

        {/* ✅ Footer fijo del sidebar */}
        <div className="sidebarFooter">
          © {year} Gustavo Montoya. All rights reserved.
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          {/* ✅ Botón hamburguesa SOLO se verá en móvil por CSS */}
          <button
            className="btnIcon mobileOnly"
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            ☰
          </button>

          <div>
            <div style={{ fontWeight: 800 }}>Panel</div>
            <div className="p">Agenda · pacientes · notas clínicas</div>
          </div>

          <div className="spacer" />
        </div>

        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}