import { Link } from "react-router-dom";
import { useState } from "react";

export default function Navbar({ onLogout, user }) {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <div style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
      <strong>Lic. Karla Mora</strong>

      <Link to="/dashboard">Dashboard</Link>
      <Link to="/patients">Patients</Link>
      <Link to="/appointments">Appointments</Link>
      <Link to="/notes">Notes</Link>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>
            {user?.email} ({user?.role})
          </span>
          <button onClick={onLogout}>Logout</button>
        </div>

        {/* 🔥 BOTÓN AVISO */}
        <button
          onClick={() => setShowPrivacy(!showPrivacy)}
          style={{
            fontSize: 12,
            opacity: 0.8,
            textDecoration: "underline",
            color: "#333",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Aviso de privacidad
        </button>

        {/* 🔥 CONTENIDO DESPLEGABLE */}
        {showPrivacy && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 10,
              background: "#fff",
              border: "1px solid var(--border)",
              fontSize: 11,
              color: "#444",
              maxWidth: 320,
              maxHeight: 300,
              overflowY: "auto",
              textAlign: "justify",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <strong>AVISO DE PRIVACIDAD DE DATOS PERSONALES Y SENSIBLES</strong>

            <br /><br />

            <strong>1. Se entiende como:</strong><br />
            Consentimiento: manifestación de la voluntad del titular de los datos mediante la cual se efectúa el tratamiento de los mismos.<br />
            Datos personales: cualquier información concerniente a una persona física identificable.<br />
            Datos sensibles: aquellos datos personales que afectan la esfera más íntima del titular.<br />
            Encargado: quien trata datos por cuenta del responsable.<br />
            Responsable: quien decide sobre el tratamiento de datos.<br />
            Terapeuta: profesionista de la salud mental encargado del tratamiento.<br />
            Titular: persona a quien pertenecen los datos.<br />
            Tratamiento: uso, almacenamiento o manejo de datos.<br />
            Transferencia: comunicación de datos a terceros.<br /><br />

            <strong>2.</strong> Los datos serán tratados por el psicoterapeuta responsable con domicilio en Aguascalientes.<br /><br />

            <strong>3.</strong> La finalidad es la elaboración del expediente clínico conforme a la Ley General de Salud.<br /><br />

            <strong>4.</strong> Solo el terapeuta responsable tendrá acceso al expediente.<br /><br />

            <strong>5.</strong> Los datos se almacenarán por 5 años según la ley.<br /><br />

            <strong>6.</strong> Transferencias podrán realizarse para diagnóstico o atención médica.<br /><br />

            <strong>7.</strong> El titular podrá solicitar acceso o modificación con identificación oficial.<br /><br />

            <strong>8.</strong> Los datos no podrán cancelarse salvo disposición legal.<br /><br />

            <strong>9.</strong> Cambios en el aviso serán notificados.<br /><br />

            <strong>10.</strong> Se protegerá la identidad del paciente.<br /><br />

            <strong>11.</strong> Se observará la Ley Federal de Protección de Datos.<br /><br />

            __________________________________________<br />
            LIC. PHU. KARLA ISABEL MORA CALVILLO<br />
            Aguascalientes, México
          </div>
        )}
      </div>
    </div>
  );
}