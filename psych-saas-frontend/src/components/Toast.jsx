import { useEffect } from "react";

export default function Toast({ show, type="info", message, onClose }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onClose?.(), 3000);
    return () => clearTimeout(t);
  }, [show, onClose]);

  if (!show) return null;

  const style = {
    position:"fixed", right:16, bottom:16,
    padding:"12px 14px",
    borderRadius:14,
    border:"1px solid var(--line)",
    background:"rgba(239, 195, 249, 0.74)",
    boxShadow:"var(--shadow)",
    minWidth:260,
  };

  const badge =
    type === "success" ? "badgeOk" :
    type === "danger" ? "badgeDanger" :
    "badgeWarn";

  const labelByType = {
  success: "Éxito",
  error: "Error",
  warning: "Aviso",
  info: "Info",
};

<span>{labelByType[type] || "Mensaje"}</span>

  return (
    <div style={style}>
      <div className="row">
        <span className={`badge ${badge}`}>{type.toUpperCase()}</span>
        <div className="spacer" />
        <button className="btn" onClick={onClose}>x</button>
      </div>
      <div style={{ marginTop: 8, color:"var(--text)" }}>{message}</div>
    </div>
  );
}