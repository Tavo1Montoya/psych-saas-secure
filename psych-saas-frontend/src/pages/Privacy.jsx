export default function Privacy() {
  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <h1 className="h1">Aviso de Privacidad</h1>
        <p className="p" style={{ opacity: 0.9 }}>
          Este sistema está diseñado para gestión de agenda y apoyo administrativo. El uso y manejo de datos personales
          debe realizarse conforme a la normativa aplicable. La responsable del tratamiento es la titular de la cuenta.
        </p>
      </div>

      <div className="card cardPad">
        <div style={{ fontWeight: 900, marginBottom: 8 }}>1) Datos que pueden registrarse</div>
        <div className="p">
          Nombre, edad, teléfono, fecha de nacimiento y campos opcionales de identificación (según lo que la usuaria
          capture). También pueden existir notas asociadas según el módulo usado.
        </div>
      </div>

      <div className="card cardPad">
        <div style={{ fontWeight: 900, marginBottom: 8 }}>2) Finalidad</div>
        <div className="p">
          Organización de pacientes y citas, control de bloqueos de agenda y soporte operativo para el trabajo clínico.
        </div>
      </div>

      <div className="card cardPad">
        <div style={{ fontWeight: 900, marginBottom: 8 }}>3) Seguridad</div>
        <div className="p">
          Acceso mediante autenticación y roles. Se recomienda el uso de contraseñas seguras y no compartir credenciales.
        </div>
      </div>

      <div className="card cardPad">
        <div style={{ fontWeight: 900, marginBottom: 8 }}>4) Contacto</div>
        <div className="p">
          Para dudas o solicitudes relacionadas con datos personales, contacta a la titular de la cuenta o administradora
          del sistema.
        </div>
      </div>
    </div>
  );
}