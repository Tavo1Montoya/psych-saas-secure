export function getCurrentRoleFromStorage() {
  try {
    return localStorage.getItem("role") || "";
  } catch {
    return "";
  }
}