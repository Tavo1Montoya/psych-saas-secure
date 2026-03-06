export function getCurrentUserFromStorage() {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("currentUser") ||
      localStorage.getItem("auth_user");

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}