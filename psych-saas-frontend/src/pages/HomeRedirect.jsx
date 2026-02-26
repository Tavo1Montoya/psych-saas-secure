import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";

export default function HomeRedirect() {
  const { role } = useAuth();

  // Assistant entra directo a pacientes
  if (role === "assistant") return <Navigate to="/patients" replace />;

  // Admin/Psychologist al dashboard
  return <Navigate to="/dashboard" replace />;
}