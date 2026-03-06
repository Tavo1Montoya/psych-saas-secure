export function buildSuccessMessage(role, actionText) {
  if (role === "psychologist") {
    return `Bien Hecho Karla, ${actionText}`;
  }

  if (role === "assistant") {
    return `Bien Hecho Pita, ${actionText}`;
  }

  return actionText;
}