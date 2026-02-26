export default function Modal({ open, title, children, onClose, footer }) {
  if (!open) return null;

  function onBackdrop(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div className="modalBackdrop" onMouseDown={onBackdrop}>
      <div className="modal">
        <div className="modalHeader">
          <div className="row">
            <h3 className="h1" style={{ fontSize: 16 }}>{title}</h3>
            <div className="spacer" />
            <button className="btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>
        <div className="modalBody">{children}</div>
        {footer && <div className="modalFooter">{footer}</div>}
      </div>
    </div>
  );
}