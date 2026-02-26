import { Link } from "react-router-dom";

export default function Navbar({ onLogout, user }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: 12, borderBottom: "1px solid #ddd" }}>
      <strong>Lic. Karla Mora</strong>

      <Link to="/dashboard">Dashboard</Link>
      <Link to="/patients">Patients</Link>
      <Link to="/appointments">Appointments</Link>
      <Link to="/notes">Notes</Link>

      <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
        <span>{user?.email} ({user?.role})</span>
        <button onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}