export default function Modal({ open, title, children, onClose, footer }) {
  if (!open) return null;

  function onBackdrop(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  return (
    <div
      className="modalBackdrop"
      onMouseDown={onBackdrop}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        zIndex: 9999,
      }}
    >
      <div
        className="modal"
        style={{
          width: "min(920px, 100%)",
          maxHeight: "90vh",
          overflow: "hidden",
          borderRadius: 18,
          background: "var(--card, #fff)",
          border: "1px solid rgba(255,255,255,.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="modalHeader"
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            flexShrink: 0,
          }}
        >
          <div
            className="row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h3 className="h1" style={{ fontSize: 16, margin: 0 }}>
              {title}
            </h3>

            <div className="spacer" style={{ flex: 1 }} />

            <button className="btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div
          className="modalBody"
          style={{
            padding: 16,
            overflowY: "auto",
            overflowX: "hidden",
            flex: 1,
          }}
        >
          {children}
        </div>

        {footer && (
          <div
            className="modalFooter"
            style={{
              padding: 16,
              borderTop: "1px solid rgba(255,255,255,.08)",
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}