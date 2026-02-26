// src/auth/useAuth.js
import { useContext } from "react";
import { AuthContext } from "./authContext"; // usa el MISMO archivo siempre

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

