// src/api/auth.js
import api from "./axios";

// FastAPI OAuth2PasswordRequestForm => FORM URL ENCODED (NO JSON)
export async function loginRequest(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  // ✅ FastAPI devuelve access_token
  return data; // { access_token, token_type }
}