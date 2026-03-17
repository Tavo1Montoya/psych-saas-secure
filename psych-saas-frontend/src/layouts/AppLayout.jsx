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

  // 🔥 NUEVO: estado aviso privacidad
  const [showPrivacy, setShowPrivacy] = useState(false);

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
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { to: "/patients", label: "Pacientes", icon: <Users size={18} /> },
    { to: "/appointments", label: "Citas", icon: <Calendar size={18} /> },

    ...(role !== "assistant"
      ? [{ to: "/notes", label: "Notas", icon: <NotebookPen size={18} /> }]
      : []),

    { to: "/blocks", label: "Bloqueos", icon: <Ban size={18} /> },
  ]), [role]);

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

        {/* 🔥 BLOQUE CON LOGOUT + AVISO */}
        <div style={{ marginTop: 18 }}>
          <button className="btn btnDanger" onClick={exit} style={{ width: "100%" }}>
            Cerrar sesión
          </button>

          {/* 🔥 BOTÓN AVISO */}
          <button
            onClick={() => setShowPrivacy(!showPrivacy)}
            style={{
              fontSize: 12,
              opacity: 0.8,
              textDecoration: "underline",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginTop: 10,
              width: "100%",
              textAlign: "center",
            }}
          >
            Aviso de privacidad
          </button>

          {/* 🔥 CONTENIDO DESPLEGABLE */}
          {showPrivacy && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 10,
                background: "#fff",
                border: "1px solid var(--border)",
                fontSize: 11,
                color: "#444",
                maxHeight: 300,
                overflowY: "auto",
                textAlign: "justify",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <strong>AVISO DE PRIVACIDAD DE DATOS PERSONALES Y SENSIBLES</strong>

              <br /><br />

              <strong>1. Se entiende como:</strong><br />
              Consentimiento: manifestación de la voluntad del titular mediante la cual se efectúa el tratamiento de datos.<br />
              Datos personales: información de una persona identificable.<br />
              Datos sensibles: información íntima que puede generar riesgo o discriminación.<br />
              Encargado: quien trata datos por cuenta del responsable.<br />
              Responsable: quien decide sobre el tratamiento.<br />
              Terapeuta: profesionista de salud mental encargado del tratamiento.<br />
              Titular: persona a quien pertenecen los datos.<br />
              Tratamiento: uso, almacenamiento o manejo de datos.<br />
              Transferencia: comunicación de datos a terceros.<br /><br />

              <strong>2.</strong> Los datos serán tratados por el psicoterapeuta responsable en Aguascalientes.<br /><br />

              <strong>3.</strong> Finalidad: expediente clínico conforme a la Ley General de Salud.<br /><br />

              <strong>4.</strong> Solo el terapeuta responsable tendrá acceso.<br /><br />

              <strong>5.</strong> Los datos se almacenarán por 5 años.<br /><br />

              <strong>6.</strong> Transferencias podrán realizarse para diagnóstico o atención médica.<br /><br />

              <strong>7.</strong> El titular podrá solicitar acceso o modificación con identificación oficial.<br /><br />

              <strong>8.</strong> Los datos no podrán cancelarse salvo disposición legal.<br /><br />

              <strong>9.</strong> Cambios serán notificados.<br /><br />

              <strong>10.</strong> Se protegerá la identidad del paciente.<br /><br />

              <strong>11.</strong> Se observará la Ley Federal de Protección de Datos.<br /><br />

              __________________________________________<br />
              LIC. PHU. KARLA ISABEL MORA CALVILLO<br />
              Aguascalientes, México
            </div>
          )}
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