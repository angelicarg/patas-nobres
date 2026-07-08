import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} ${months[parseInt(m, 10) - 1]}`;
}

function formatTime(timeStr) {
  return timeStr ? timeStr.slice(0, 5) : "";
}

export default function AgendaManager() {
  const [professionals, setProfessionals] = useState([]);
  const [professionalId, setProfessionalId] = useState(null);
  const [services, setServices] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningKey, setActioningKey] = useState(null);
  const [menu, setMenu] = useState(null); // { slot, mode: "choose" | "form" }
  const [bookForm, setBookForm] = useState({ name: "", phone: "", petName: "", serviceId: "" });
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");

  useEffect(() => {
    supabase.from("pn_professionals").select("*").eq("active", true).order("name").then(({ data }) => {
      if (data?.length) {
        setProfessionals(data);
        setProfessionalId(data[0].id);
      }
    });
    supabase.from("pn_services").select("*").eq("active", true).order("price").then(({ data }) => setServices(data || []));
  }, []);

  const loadSlots = useCallback(async () => {
    if (!professionalId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("pn_time_slots")
      .select("*")
      .eq("professional_id", professionalId)
      .gte("slot_date", new Date().toISOString().slice(0, 10))
      .order("slot_date")
      .order("slot_time");
    if (!error) setSlots(data || []);
    setLoading(false);
  }, [professionalId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, []);
      map.get(s.slot_date).push(s);
    }
    return [...map.entries()];
  }, [slots]);

  function slotState(s) {
    if (s.is_available) return "open";
    if (s.blocked) return "blocked";
    return "booked";
  }

  async function toggleSlot(s) {
    setActioningKey(s.id);
    if (slotState(s) === "open") {
      await supabase.from("pn_time_slots").update({ is_available: false, blocked: true }).eq("id", s.id);
    } else if (slotState(s) === "blocked") {
      await supabase.from("pn_time_slots").update({ is_available: true, blocked: false }).eq("id", s.id);
    }
    await loadSlots();
    setActioningKey(null);
  }

  async function blockDay(date) {
    setActioningKey(date);
    await supabase.from("pn_time_slots").update({ is_available: false, blocked: true }).eq("professional_id", professionalId).eq("slot_date", date).eq("is_available", true);
    await loadSlots();
    setActioningKey(null);
  }

  async function unblockDay(date) {
    setActioningKey(date);
    await supabase.from("pn_time_slots").update({ is_available: true, blocked: false }).eq("professional_id", professionalId).eq("slot_date", date).eq("blocked", true);
    await loadSlots();
    setActioningKey(null);
  }

  function openMenu(s) {
    setMenu({ slot: s, mode: "choose" });
    setBookForm({ name: "", phone: "", petName: "", serviceId: services[0]?.id || "" });
    setBookError("");
  }

  function closeMenu() {
    setMenu(null);
    setBookError("");
  }

  async function handleBlockFromMenu() {
    await toggleSlot(menu.slot);
    closeMenu();
  }

  async function handleBookSubmit() {
    if (!bookForm.name || !bookForm.phone || !bookForm.petName || !bookForm.serviceId) return;
    setBooking(true);
    setBookError("");

    const phone = bookForm.phone.replace(/\D/g, "");
    let { data: client } = await supabase.from("pn_clients").select("id").eq("phone", phone).maybeSingle();
    if (!client) {
      const { data: newClient, error: clientError } = await supabase.from("pn_clients").insert({ name: bookForm.name, phone }).select("id").single();
      if (clientError) {
        setBooking(false);
        setBookError("Não foi possível cadastrar o tutor. Tente novamente.");
        return;
      }
      client = newClient;
    }

    const { data: pet, error: petError } = await supabase.from("pn_pets").insert({ client_id: client.id, name: bookForm.petName, species: "Não informado" }).select("id").single();
    if (petError) {
      setBooking(false);
      setBookError("Não foi possível cadastrar o pet. Tente novamente.");
      return;
    }

    const { error: apptError } = await supabase.from("pn_appointments").insert({
      time_slot_id: menu.slot.id,
      service_id: bookForm.serviceId,
      client_id: client.id,
      pet_id: pet.id,
      status: "confirmed",
    });
    if (apptError) {
      setBooking(false);
      setBookError("Não foi possível agendar. Tente novamente.");
      return;
    }
    await supabase.from("pn_time_slots").update({ is_available: false }).eq("id", menu.slot.id);
    await loadSlots();
    setBooking(false);
    closeMenu();
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "#7A8B7D", marginBottom: 16 }}>
        Bloqueie dias inteiros (folgas, feriados) ou horários pontuais para cada profissional, ou agende
        diretamente um tutor que ligou ou foi até a loja. Horários já reservados não podem ser alterados por aqui.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {professionals.map((p) => (
          <button key={p.id} onClick={() => setProfessionalId(p.id)} style={{
            padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: professionalId === p.id ? "none" : "1px solid #DCE5D6",
            background: professionalId === p.id ? p.color : "#fff",
            color: professionalId === p.id ? "#fff" : "#4A5B45",
          }}>
            {p.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Carregando agenda...</p>
      ) : byDate.length === 0 ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Nenhum horário cadastrado para este profissional.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {byDate.map(([date, daySlots]) => {
            const hasOpen = daySlots.some((s) => slotState(s) === "open");
            const hasBlocked = daySlots.some((s) => slotState(s) === "blocked");
            return (
              <div key={date} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5EEE1", padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <strong style={{ fontSize: 14, color: "#2F5233" }}>{formatDate(date)}</strong>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button disabled={!hasOpen || actioningKey === date} onClick={() => blockDay(date)} style={smallBtn(hasOpen, "#C0392B")}>Bloquear dia inteiro</button>
                    <button disabled={!hasBlocked || actioningKey === date} onClick={() => unblockDay(date)} style={smallBtn(hasBlocked, "#2F5233")}>Desbloquear dia</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {daySlots.map((s) => {
                    const state = slotState(s);
                    return (
                      <button key={s.id} disabled={state === "booked" || actioningKey === s.id} onClick={() => (state === "open" ? openMenu(s) : toggleSlot(s))}
                        title={state === "booked" ? "Reservado por um tutor" : state === "blocked" ? "Clique para desbloquear" : "Clique para bloquear ou agendar um tutor"}
                        style={{
                          padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: state === "booked" ? "default" : "pointer", border: "1px solid",
                          borderColor: state === "open" ? "#DCE5D6" : state === "blocked" ? "#C0392B33" : "#2F523333",
                          background: state === "open" ? "#F6F1E7" : state === "blocked" ? "#FBEAEA" : "#EAF1E7",
                          color: state === "open" ? "#2F5233" : state === "blocked" ? "#C0392B" : "#2F5233",
                          textDecoration: state === "blocked" ? "line-through" : "none",
                          outline: menu?.slot.id === s.id ? "2px solid #2F5233" : "none", outlineOffset: 2,
                        }}>
                        {formatTime(s.slot_time)}{state === "booked" ? " · reservado" : ""}
                      </button>
                    );
                  })}
                </div>

                {menu && menu.slot.slot_date === date && (
                  <div style={{ marginTop: 12, padding: "14px 16px", background: "#F6F1E7", borderRadius: 10 }}>
                    {menu.mode === "choose" ? (
                      <>
                        <p style={{ fontSize: 13, color: "#2F5233", marginBottom: 10 }}>
                          Horário <strong>{formatTime(menu.slot.slot_time)}</strong> livre — o que deseja fazer?
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={handleBlockFromMenu} style={menuBtn("#C0392B")}>🔒 Bloquear horário</button>
                          <button onClick={() => setMenu({ ...menu, mode: "form" })} style={menuBtn("#2F5233")}>📝 Agendar tutor</button>
                          <button onClick={closeMenu} style={menuBtn("#7A8B7D")}>Cancelar</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 13, color: "#2F5233", marginBottom: 10 }}>
                          Agendar tutor para <strong>{formatTime(menu.slot.slot_time)}</strong>
                        </p>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                          <input placeholder="Nome do tutor" value={bookForm.name} onChange={(e) => setBookForm({ ...bookForm, name: e.target.value })} style={menuInput} />
                          <input placeholder="Telefone / WhatsApp" value={bookForm.phone} onChange={(e) => setBookForm({ ...bookForm, phone: e.target.value })} style={menuInput} />
                          <input placeholder="Nome do pet" value={bookForm.petName} onChange={(e) => setBookForm({ ...bookForm, petName: e.target.value })} style={menuInput} />
                          <select value={bookForm.serviceId} onChange={(e) => setBookForm({ ...bookForm, serviceId: e.target.value })} style={menuInput}>
                            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        {bookError && <p style={{ fontSize: 12, color: "#C0392B", marginBottom: 8 }}>{bookError}</p>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={handleBookSubmit} disabled={!bookForm.name || !bookForm.phone || !bookForm.petName || booking} style={menuBtn("#2F5233", !bookForm.name || !bookForm.phone || !bookForm.petName || booking)}>
                            {booking ? "Agendando..." : "Confirmar agendamento"}
                          </button>
                          <button onClick={closeMenu} style={menuBtn("#7A8B7D")}>Cancelar</button>
                        </div>
                      </>
                    )}
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

function smallBtn(enabled, color) {
  return { background: enabled ? "#fff" : "#F8FAF7", border: `1.5px solid ${enabled ? color : "#E5EEE1"}`, color: enabled ? color : "#B8C7B2", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: enabled ? "pointer" : "not-allowed" };
}

function menuBtn(color, disabled = false) {
  return { background: disabled ? "#F8FAF7" : "#fff", border: `1.5px solid ${disabled ? "#E5EEE1" : color}`, color: disabled ? "#B8C7B2" : color, borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" };
}

const menuInput = { flex: "1 1 160px", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #DCE5D6", fontSize: 13, color: "#2F5233", outline: "none", fontFamily: "Inter, sans-serif", background: "#fff" };
