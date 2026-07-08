import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} ${months[parseInt(m, 10) - 1]}`;
}

function inNext7Days(dateStr) {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  const limitStr = limit.toISOString().slice(0, 10);
  return dateStr >= today && dateStr <= limitStr;
}

export default function RemindersPanel() {
  const [pets, setPets] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingKey, setSendingKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: petsData }, { data: remindersData }] = await Promise.all([
      supabase.from("pn_pets").select("*, pn_clients(*)"),
      supabase.from("pn_reminders").select("*"),
    ]);
    setPets(petsData || []);
    setReminders(remindersData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const dueItems = useMemo(() => {
    const items = [];
    for (const pet of pets) {
      if (inNext7Days(pet.next_grooming_due)) {
        items.push({ pet, type: "grooming", label: "Banho/tosa", dueDate: pet.next_grooming_due });
      }
      if (inNext7Days(pet.next_vaccine_due)) {
        items.push({ pet, type: "vaccine", label: "Vacina", dueDate: pet.next_vaccine_due });
      }
    }
    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [pets]);

  function findReminder(petId, type, dueDate) {
    return reminders.find((r) => r.pet_id === petId && r.type === type && r.due_date === dueDate);
  }

  async function markSent(item) {
    const key = `${item.pet.id}-${item.type}-${item.dueDate}`;
    setSendingKey(key);
    const existing = findReminder(item.pet.id, item.type, item.dueDate);
    if (existing) {
      await supabase.from("pn_reminders").update({ status: "sent_simulated", sent_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("pn_reminders").insert({ pet_id: item.pet.id, type: item.type, due_date: item.dueDate, status: "sent_simulated", sent_at: new Date().toISOString() });
    }
    await load();
    setSendingKey(null);
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#2F5233", marginBottom: 6 }}>Lembretes</h1>
      <p style={{ fontSize: 13, color: "#7A8B7D", marginBottom: 24 }}>
        Pets com banho/tosa ou vacina previstos para os próximos 7 dias. O envio por WhatsApp é simulado nesta demo —
        marque como enviado para registrar o contato.
      </p>

      {loading ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Carregando...</p>
      ) : dueItems.length === 0 ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Nenhum lembrete pendente nos próximos 7 dias.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dueItems.map((item) => {
            const key = `${item.pet.id}-${item.type}-${item.dueDate}`;
            const existing = findReminder(item.pet.id, item.type, item.dueDate);
            const sent = existing?.status === "sent_simulated";
            return (
              <div key={key} style={{ background: "#fff", border: "1px solid #E5EEE1", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2F5233" }}>{item.label} · {item.pet.name}</div>
                  <div style={{ fontSize: 12, color: "#7A8B7D", marginTop: 2 }}>
                    Tutor: {item.pet.pn_clients?.name} · {item.pet.pn_clients?.phone} · Previsto para {formatDate(item.dueDate)}
                  </div>
                </div>
                {sent ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2F5233", background: "#2F523315", borderRadius: 100, padding: "6px 14px" }}>✅ Enviado (simulado)</span>
                ) : (
                  <button
                    disabled={sendingKey === key}
                    onClick={() => markSent(item)}
                    style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: sendingKey === key ? 0.6 : 1 }}
                  >
                    💬 Marcar como enviado (simulado)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
