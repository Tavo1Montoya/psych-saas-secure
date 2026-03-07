import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, NotebookPen, Ban } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { useEffect, useMemo, useState } from "react";

export default function AppLayout() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    // ✅ Dashboard YA visible para assistant
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },

    { to: "/patients", label: "Pacientes", icon: <Users size={18} /> },
    { to: "/appointments", label: "Citas", icon: <Calendar size={18} /> },

    // ✅ Notas sigue oculto para assistant si así lo deseas
    ...(role !== "assistant"
      ? [{ to: "/notes", label: "Notas", icon: <NotebookPen size={18} /> }]
      : []),

    { to: "/blocks", label: "Bloqueos", icon: <Ban size={18} /> },
  ]), [role]);

  // ✅ Cierra sidebar al cambiar de ruta
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const year = new Date().getFullYear();

  return (
    <div className="layout">
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
              onClick={() => setSidebarOpen(false)}
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

        <div className="sidebarFooter">
          ©️ {year} Gustavo Montoya. All rights reserved.
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
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