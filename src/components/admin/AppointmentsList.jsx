import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

const STATUS_LABEL = { pending: "Pendente", confirmed: "Confirmado", rejected: "Recusado" };
const STATUS_COLOR = { pending: "#B7770D", confirmed: "#2F5233", rejected: "#C0392B" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} ${months[parseInt(m, 10) - 1]}`;
}

function formatTime(timeStr) {
  return timeStr ? timeStr.slice(0, 5) : "";
}

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [filter, setFilter] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pn_appointments")
      .select("*, pn_time_slots(*, pn_professionals(*)), pn_services(*), pn_clients(*), pn_pets(*)")
      .order("created_at", { ascending: false });
    if (!error) setAppointments(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm(id) {
    setActioningId(id);
    await supabase.from("pn_appointments").update({ status: "confirmed" }).eq("id", id);
    await load();
    setActioningId(null);
  }

  async function handleReject(appointment) {
    setActioningId(appointment.id);
    await supabase.from("pn_appointments").update({ status: "rejected" }).eq("id", appointment.id);
    await supabase.from("pn_time_slots").update({ is_available: true }).eq("id", appointment.time_slot_id);
    await load();
    setActioningId(null);
  }

  const visible = filter === "all" ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#2F5233", marginBottom: 6 }}>Agendamentos</h1>
      <p style={{ fontSize: 13, color: "#7A8B7D", marginBottom: 24 }}>Confirme ou recuse os pedidos de banho e tosa feitos pelo site.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[["pending", "Pendentes"], ["confirmed", "Confirmados"], ["rejected", "Recusados"], ["all", "Todos"]].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: "7px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: filter === key ? "none" : "1px solid #DCE5D6",
            background: filter === key ? "#2F5233" : "#fff",
            color: filter === key ? "#fff" : "#7A8B7D",
          }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Carregando...</p>
      ) : visible.length === 0 ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Nenhum agendamento nessa categoria.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((a) => {
            const pro = a.pn_time_slots?.pn_professionals;
            return (
              <div key={a.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5EEE1", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#2F5233" }}>{a.pn_pets?.name} · {a.pn_clients?.name}</div>
                    <div style={{ fontSize: 13, color: "#4A5B45", marginTop: 2 }}>
                      {a.pn_clients?.phone}{a.pn_clients?.email ? ` · ${a.pn_clients.email}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: STATUS_COLOR[a.status], background: `${STATUS_COLOR[a.status]}15`, borderRadius: 100, padding: "4px 12px", whiteSpace: "nowrap" }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>

                <div style={{ marginTop: 12, padding: "10px 14px", background: "#F6F1E7", borderRadius: 10, fontSize: 13, color: "#2F5233" }}>
                  <strong>{a.pn_services?.name}</strong> · {pro?.name}
                  <br />
                  📅 {formatDate(a.pn_time_slots?.slot_date)} às {formatTime(a.pn_time_slots?.slot_time)}
                  {a.pn_pets?.species && <><br />🐾 {a.pn_pets.species}{a.pn_pets.breed ? ` · ${a.pn_pets.breed}` : ""}</>}
                  {a.pn_pets?.restrictions && <><br />⚠️ {a.pn_pets.restrictions}</>}
                </div>

                {a.note && <p style={{ marginTop: 10, fontSize: 13, color: "#4A5B45", fontStyle: "italic" }}>"{a.note}"</p>}

                {a.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button disabled={actioningId === a.id} onClick={() => handleConfirm(a.id)} style={{ background: "#2F5233", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: actioningId === a.id ? 0.6 : 1 }}>
                      ✅ Confirmar
                    </button>
                    <button disabled={actioningId === a.id} onClick={() => handleReject(a)} style={{ background: "#fff", color: "#C0392B", border: "1.5px solid #C0392B", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: actioningId === a.id ? 0.6 : 1 }}>
                      ✕ Recusar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
