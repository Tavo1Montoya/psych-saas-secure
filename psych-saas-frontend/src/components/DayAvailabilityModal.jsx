export default function DayAvailabilityModal({
  open,
  onClose,
  date,
  slots = [],
  onSchedule, // (timeStr) => void
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        className="card cardPad"
        style={{
          width: "min(860px, 100%)",
          maxHeight: "min(80vh, 820px)",
          overflow: "auto",
          borderColor: "rgba(255,255,255,.10)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Disponibilidad del día</div>
            <div className="p" style={{ margin: "4px 0 0 0", opacity: 0.8 }}>
              {date}
            </div>
          </div>

          <button className="btn" onClick={onClose} style={{ height: 36 }}>
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {slots.length === 0 ? (
            <div className="p">No hay slots para mostrar.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {slots.map((s, idx) => {
                const isFree = s.status === "free";
                const isBooked = s.status === "booked";
                const isBlocked = s.status === "blocked";

                let badgeBg = "rgba(255,255,255,.06)";
                let badgeBr = "rgba(255,255,255,.14)";
                let label = "Libre";

                if (isBooked) {
                  badgeBg = "rgba(80,160,255,.14)";
                  badgeBr = "rgba(80,160,255,.28)";
                  label = "Ocupado";
                }
                if (isBlocked) {
                  badgeBg = "rgba(255,90,122,.14)";
                  badgeBr = "rgba(255,90,122,.28)";
                  label = "Bloqueado";
                }

                return (
                  <div
                    key={`${s.start}-${idx}`}
                    className="card"
                    style={{
                      padding: 12,
                      background: "rgba(255,255,255,.03)",
                      borderColor: "rgba(255,255,255,.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900 }}>
                        {s.start} – {s.end}
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 999,
                          border: `1px solid ${badgeBr}`,
                          background: badgeBg,
                          fontSize: 12,
                          fontWeight: 800,
                          marginTop: 6,
                        }}
                      >
                        {label}
                      </div>
                    </div>

                    {isFree ? (
                      <button className="btn" onClick={() => onSchedule?.(s.start)} style={{ height: 36 }}>
                        Agendar
                      </button>
                    ) : (
                      <button className="btn" disabled style={{ height: 36, opacity: 0.6, cursor: "not-allowed" }}>
                        Agendar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p" style={{ marginTop: 14, opacity: 0.8 }}>
          Tip: El botón “Agendar” te manda a Citas con la fecha/hora preseleccionada.
        </div>
      </div>
    </div>
  );
}