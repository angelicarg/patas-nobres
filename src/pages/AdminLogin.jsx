import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { PRIMARY, TEXT_MUTED, BORDER, BG_PAGE } from "../components/BookingModal";
import PawMark from "../components/PawMark";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/admin", { replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    navigate("/admin", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, #1F3A24 0%, ${PRIMARY} 50%, #4A7A52 100%)`, fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 20, padding: "40px 32px", width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(31,58,36,0.35)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, margin: "0 auto 14px", background: `linear-gradient(135deg, ${PRIMARY}, #1F3A24)`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PawMark size={28} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: PRIMARY }}>Área da equipe</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 4 }}>Patas Nobres — acesso restrito</p>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginBottom: 5 }}>E-mail</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginTop: 14, marginBottom: 5 }}>Senha</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />

        {error && <p style={{ color: "#B5384C", fontSize: 13, marginTop: 14 }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ marginTop: 22, width: "100%", background: `linear-gradient(135deg, ${PRIMARY}, #1F3A24)`, color: "#fff", border: "none", padding: "12px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/" style={{ fontSize: 12, color: TEXT_MUTED, textDecoration: "none" }}>← Voltar ao site</a>
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 14, color: PRIMARY,
  outline: "none", fontFamily: "Inter, sans-serif", background: BG_PAGE, boxSizing: "border-box",
};
