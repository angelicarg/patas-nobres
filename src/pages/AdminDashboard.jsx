import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import AppointmentsList from "../components/admin/AppointmentsList";
import AgendaManager from "../components/admin/AgendaManager";
import ProductsManager from "../components/admin/ProductsManager";
import OrdersList from "../components/admin/OrdersList";
import ClientsDirectory from "../components/admin/ClientsDirectory";
import RemindersPanel from "../components/admin/RemindersPanel";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [domain, setDomain] = useState("agenda");
  const [agendaTab, setAgendaTab] = useState("agendamentos");
  const [lojaTab, setLojaTab] = useState("produtos");
  const [clientesTab, setClientesTab] = useState("clientes");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/admin/login", { replace: true });
        return;
      }
      setCheckingSession(false);
    });
  }, [navigate]);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  if (checkingSession) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#FBF6EF", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #E5EEE1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #2F5233, #1F3A24)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🐾</div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, color: "#2F5233" }}>Patas Nobres · Painel da equipe</span>
        </div>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid #E5EEE1", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#4A5B45", cursor: "pointer" }}>
          Sair
        </button>
      </header>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["agenda", "🗓️ Agenda"], ["loja", "🛍️ Loja"], ["clientes", "🐕 Clientes & Pets"]].map(([key, label]) => (
            <button key={key} onClick={() => setDomain(key)} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
              background: domain === key ? "#2F5233" : "transparent",
              color: domain === key ? "#fff" : "#4A5B45",
            }}>
              {label}
            </button>
          ))}
        </div>

        {domain === "agenda" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, borderBottom: "1px solid #E5EEE1", paddingBottom: 16 }}>
              {[["agendamentos", "📋 Agendamentos"], ["grade", "🗓️ Grade dos profissionais"]].map(([key, label]) => (
                <button key={key} onClick={() => setAgendaTab(key)} style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                  background: agendaTab === key ? "#1F3A24" : "transparent",
                  color: agendaTab === key ? "#fff" : "#4A5B45",
                }}>
                  {label}
                </button>
              ))}
            </div>
            {agendaTab === "agendamentos" && <AppointmentsList />}
            {agendaTab === "grade" && <AgendaManager />}
          </>
        )}

        {domain === "loja" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, borderBottom: "1px solid #E5EEE1", paddingBottom: 16 }}>
              {[["produtos", "🐾 Produtos"], ["pedidos", "🧾 Pedidos"]].map(([key, label]) => (
                <button key={key} onClick={() => setLojaTab(key)} style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                  background: lojaTab === key ? "#1F3A24" : "transparent",
                  color: lojaTab === key ? "#fff" : "#4A5B45",
                }}>
                  {label}
                </button>
              ))}
            </div>
            {lojaTab === "produtos" && <ProductsManager />}
            {lojaTab === "pedidos" && <OrdersList />}
          </>
        )}

        {domain === "clientes" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 28, borderBottom: "1px solid #E5EEE1", paddingBottom: 16 }}>
              {[["clientes", "🐕 Clientes"], ["lembretes", "🔔 Lembretes"]].map(([key, label]) => (
                <button key={key} onClick={() => setClientesTab(key)} style={{
                  padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                  background: clientesTab === key ? "#1F3A24" : "transparent",
                  color: clientesTab === key ? "#fff" : "#4A5B45",
                }}>
                  {label}
                </button>
              ))}
            </div>
            {clientesTab === "clientes" && <ClientsDirectory />}
            {clientesTab === "lembretes" && <RemindersPanel />}
          </>
        )}
      </main>
    </div>
  );
}
