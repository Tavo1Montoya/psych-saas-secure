// src/pages/Login.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";


// Iconos simples (sin librerías extra)
function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5Zm3 8H9V6a3 3 0 0 1 6 0v3Z"
      />
    </svg>
  );
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
      />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2 5.27 3.28 4 20 20.72 18.73 22l-3.1-3.1A11.2 11.2 0 0 1 12 19C5 19 2 12 2 12a18.3 18.3 0 0 1 5.02-6.33L2 5.27ZM12 7c7 0 10 5 10 5a17 17 0 0 1-3.19 4.06l-2.2-2.2A4 4 0 0 0 10.14 7.6L8.52 5.98A11.6 11.6 0 0 1 12 7Z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);

  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const data = await login(email, password);

      // ✅ No tocamos tu lógica actual
      console.log("✅ LOGIN OK:", data, { remember });

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("❌ Login error:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "No se pudo iniciar sesión";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginPage">
      <div className="loginShell">
        {/* Header superior (logo + marca) */}
        <div className="loginBrand">
          <div className="brandLogo" aria-hidden="true">
            <span className="psi">Ψ</span>
          </div>

          <div className="brandText">
            <div className="brandTitle">PSIC. KARLA MORA</div>
            <div className="brandSub">Plataforma de Gestión Psicológica</div>
          </div>
        </div>

        {/* Card */}
        <div className="loginCard">
          <div className="loginCardTitle">Iniciar Sesión</div>
          <div className="loginCardSub">Accede a tu cuenta</div>

          <form onSubmit={handleSubmit} className="loginForm">
            {/* Email */}
            <label className="srOnly" htmlFor="email">
              Correo electrónico
            </label>
            <div className="inputShell">
              <div className="inputIcon">
                <MailIcon />
              </div>
              <input
                id="email"
                className="loginInput"
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <label className="srOnly" htmlFor="password">
              Contraseña
            </label>
            <div className="inputShell">
              <div className="inputIcon">
                <LockIcon />
              </div>
              <input
                id="password"
                className="loginInput"
                type={showPwd ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="iconBtn"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <EyeIcon open={showPwd} />
              </button>
            </div>

            {/* Error */}
            {errorMsg ? <div className="loginError">{errorMsg}</div> : null}

            {/* Botón */}
            <button className="loginBtn" type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
              <span className="loginArrow" aria-hidden="true">
                →
              </span>
            </button>

            {/* Row: recordar / forgot */}
            <div className="loginRow">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Recordarme
              </label>

              {/* Solo UI: después si quieres lo conectamos */}
              <button
                type="button"
                className="linkBtn"
                onClick={() => alert("Luego conectamos recuperación de contraseña 🙂")}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* ❌ Quitado: divider + social */}
            {/* <div className="divider"><span>o continuar con</span></div> */}
            {/* <div className="socialRow"> ... </div> */}
          </form>
        </div>

        {/* Footer */}
        <div className="loginFooter">
          {/* ❌ Quitado: Crear cuenta */}
          {/* <div className="footerLine">
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              className="linkBtn strong"
              onClick={() => alert("Por seguridad: solo Admin crea cuentas 🙂")}
            >
              Crear Cuenta
            </button>
          </div> */}

          <div className="footerMini">
             ©️ {year} Gustavo Montoya. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}