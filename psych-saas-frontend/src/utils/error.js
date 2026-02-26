// src/utils/error.js
export function prettyApiError(e) {
  const data = e?.response?.data;

  // FastAPI 422 / validation errors
  const detail = data?.detail;

  if (Array.isArray(detail)) {
    // Convierte cada error a texto legible
    return detail
      .map((x) => {
        const where = Array.isArray(x?.loc) ? x.loc.join(" > ") : "field";
        return `${where}: ${x?.msg || "Error de validación"}`;
      })
      .join("\n");
  }

  // FastAPI normal errors (string)
  if (typeof detail === "string") return detail;

  // fallback
  return e?.message || "Error desconocido";
}