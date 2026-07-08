import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} ${months[parseInt(m, 10) - 1]}`;
}

function formatTime(timeStr) {
  // Postgres "time" comes back as "09:00:00" — trim to "09:00".
  return timeStr ? timeStr.slice(0, 5) : "";
}

function formatBRL(value) {
  return `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
}

export function ProAvatar({ pro, size = 44 }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${pro.color}cc, ${pro.color})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700, fontSize: size * 0.32, flexShrink: 0, letterSpacing: 1,
      }}
    >
      {pro.initials}
    </div>
  );
}

export function BookingModal({ onClose, initialServiceSlug }) {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [serviceId, setServiceId] = useState(null);
  const [professionalId, setProfessionalId] = useState("any");
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    petName: "", petSpecies: "Cachorro", petBreed: "", petNotes: "", note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("pn_services").select("*").eq("active", true).order("price"),
      supabase.from("pn_professionals").select("*").eq("active", true).order("name"),
    ]).then(([{ data: svc }, { data: pros }]) => {
      setServices(svc || []);
      setProfessionals(pros || []);
      if (initialServiceSlug) {
        const match = (svc || []).find((s) => s.slug === initialServiceSlug);
        if (match) setServiceId(match.id);
      }
      setLoadingBase(false);
    });
  }, [initialServiceSlug]);

  const service = services.find((s) => s.id === serviceId);
  const professional = professionals.find((p) => p.id === professionalId);

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedDate("");
    setSelectedSlotId(null);
    let query = supabase
      .from("pn_time_slots")
      .select("*, pn_professionals(*)")
      .eq("is_available", true)
      .gte("slot_date", new Date().toISOString().slice(0, 10))
      .order("slot_date")
      .order("slot_time");
    if (professionalId !== "any") query = query.eq("professional_id", professionalId);
    query.then(({ data, error }) => {
      if (!error) setSlots(data || []);
      setLoadingSlots(false);
    });
  }, [professionalId]);

  const availableDates = [...new Set(slots.map((s) => s.slot_date))];
  const timesForSelectedDate = slots.filter((s) => s.slot_date === selectedDate);

  async function handleConfirm() {
    if (!form.name || !form.phone || !form.petName || !selectedSlotId) return;
    setSubmitting(true);
    setSubmitError("");

    const { error } = await supabase.rpc("pn_book_appointment", {
      p_slot_id: selectedSlotId,
      p_service_id: serviceId,
      p_client_name: form.name,
      p_client_phone: form.phone,
      p_client_email: form.email || null,
      p_pet_name: form.petName,
      p_pet_species: form.petSpecies,
      p_pet_breed: form.petBreed || null,
      p_pet_notes: form.petNotes || null,
      p_note: form.note || null,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(
        error.message.includes("já foi reservado")
          ? "Ops! Esse horário acabou de ser reservado por outro tutor. Escolha outro."
          : "Não foi possível confirmar o agendamento agora. Tente novamente em instantes."
      );
      return;
    }

    setConfirmed(true);
  }

  const chosenSlot = timesForSelectedDate.find((s) => s.id === selectedSlotId);

  if (confirmed) {
    return (
      <ModalShell onClose={onClose}>
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🐾</div>
          <h2 style={{ color: PRIMARY, marginBottom: 8, fontSize: 22 }}>Agendamento feito!</h2>
          <p style={{ color: TEXT_MUTED, marginBottom: 24, lineHeight: 1.6 }}>
            <strong>{form.petName}</strong> está agendado(a) para <strong>{service?.name}</strong>
            <br />
            no dia <strong>{formatDate(selectedDate)}</strong> às{" "}
            <strong>{formatTime(chosenSlot?.slot_time)}</strong>
            {chosenSlot?.pn_professionals ? <> com <strong>{chosenSlot.pn_professionals.name}</strong></> : ""}.
          </p>
          <p style={{ color: TEXT_MUTED, fontSize: 13, marginBottom: 24 }}>
            A Patas Nobres vai confirmar o horário em breve pelo telefone informado.
          </p>
          <button onClick={onClose} style={btnPrimary}>Fechar</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? PRIMARY : BORDER, transition: "background 0.3s" }} />
        ))}
      </div>

      {step === 1 && (
        <div>
          <h3 style={modalTitle}>Qual serviço seu pet precisa?</h3>
          {loadingBase ? (
            <p style={modalSub}>Carregando...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setServiceId(s.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                    border: serviceId === s.id ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                    background: serviceId === s.id ? `${PRIMARY}12` : BG_CARD,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: PRIMARY }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>{s.description}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: ACCENT, whiteSpace: "nowrap", marginLeft: 12 }}>
                    {formatBRL(s.price)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button disabled={!serviceId} onClick={() => setStep(2)} style={serviceId ? btnPrimary : btnDisabled}>
            Continuar →
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} style={backBtn}>← Voltar</button>
          <h3 style={modalTitle}>Profissional e horário</h3>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setProfessionalId("any")}
              style={{
                padding: "8px 16px", borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: professionalId === "any" ? "none" : `1px solid ${BORDER}`,
                background: professionalId === "any" ? PRIMARY : "#fff",
                color: professionalId === "any" ? "#fff" : TEXT_MUTED,
              }}
            >
              Sem preferência
            </button>
            {professionals.map((p) => (
              <button
                key={p.id}
                onClick={() => setProfessionalId(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 14px 6px 6px", borderRadius: 100, cursor: "pointer",
                  border: professionalId === p.id ? `2px solid ${p.color}` : `1px solid ${BORDER}`,
                  background: professionalId === p.id ? `${p.color}12` : "#fff",
                }}
              >
                <ProAvatar pro={p} size={26} />
                <span style={{ fontSize: 13, fontWeight: 600, color: PRIMARY }}>{p.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {professional && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "10px 14px", background: BG_PAGE, borderRadius: 10 }}>
              <ProAvatar pro={professional} size={36} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: PRIMARY }}>{professional.name}</div>
                <div style={{ fontSize: 12, color: professional.color }}>{professional.role_title}</div>
              </div>
            </div>
          )}

          {loadingSlots ? (
            <p style={modalSub}>Carregando horários...</p>
          ) : availableDates.length === 0 ? (
            <p style={modalSub}>Nenhum horário disponível no momento.</p>
          ) : (
            <>
              <p style={modalSub}>Datas disponíveis</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {availableDates.map((date) => (
                  <button
                    key={date}
                    onClick={() => { setSelectedDate(date); setSelectedSlotId(null); }}
                    style={{
                      padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500,
                      border: selectedDate === date ? "none" : `1px solid ${BORDER}`,
                      background: selectedDate === date ? PRIMARY : BG_PAGE,
                      color: selectedDate === date ? "#fff" : PRIMARY,
                    }}
                  >
                    {formatDate(date)}
                  </button>
                ))}
              </div>

              {selectedDate && (
                <>
                  <p style={modalSub}>Horários disponíveis</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                    {timesForSelectedDate.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSlotId(s.id)}
                        style={{
                          padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500,
                          border: selectedSlotId === s.id ? "none" : `1px solid ${BORDER}`,
                          background: selectedSlotId === s.id ? PRIMARY : BG_PAGE,
                          color: selectedSlotId === s.id ? "#fff" : PRIMARY,
                        }}
                      >
                        {formatTime(s.slot_time)}{professionalId === "any" ? ` · ${s.pn_professionals?.name.split(" ")[0]}` : ""}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <button disabled={!selectedSlotId} onClick={() => setStep(3)} style={selectedSlotId ? btnPrimary : btnDisabled}>
            Continuar →
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <button onClick={() => setStep(2)} style={backBtn}>← Voltar</button>
          <h3 style={modalTitle}>Dados do tutor e do pet</h3>

          <div style={{ padding: "12px 16px", background: BG_PAGE, borderRadius: 10, marginBottom: 20, fontSize: 13, color: PRIMARY, lineHeight: 1.7 }}>
            <strong>{service?.name}</strong> · {formatBRL(service?.price || 0)}
            <br />
            📅 {formatDate(selectedDate)} às {formatTime(chosenSlot?.slot_time)}
            {chosenSlot?.pn_professionals ? ` · ${chosenSlot.pn_professionals.name}` : ""}
          </div>

          {[
            { label: "Seu nome *", key: "name", placeholder: "Nome do tutor", type: "text" },
            { label: "WhatsApp *", key: "phone", placeholder: "(00) 00000-0000", type: "tel" },
            { label: "E-mail", key: "email", placeholder: "seu@email.com", type: "email" },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={fieldLabel}>{label}</label>
              <input type={type} placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} style={inputStyle} />
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={fieldLabel}>Nome do pet *</label>
              <input placeholder="Nome do pet" value={form.petName} onChange={(e) => setForm({ ...form, petName: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ width: 130 }}>
              <label style={fieldLabel}>Espécie</label>
              <select value={form.petSpecies} onChange={(e) => setForm({ ...form, petSpecies: e.target.value })} style={inputStyle}>
                <option>Cachorro</option>
                <option>Gato</option>
                <option>Outro</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={fieldLabel}>Raça (opcional)</label>
            <input placeholder="Raça do pet" value={form.petBreed} onChange={(e) => setForm({ ...form, petBreed: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={fieldLabel}>Restrições ou observações do pet</label>
            <textarea placeholder="Alergias, comportamento, cuidados especiais..." value={form.petNotes} onChange={(e) => setForm({ ...form, petNotes: e.target.value })} style={{ ...inputStyle, height: 60, resize: "vertical" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Observações do agendamento</label>
            <textarea placeholder="Algum detalhe sobre este atendimento..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle, height: 60, resize: "vertical" }} />
          </div>

          {submitError && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: 14 }}>{submitError}</p>}

          <button
            disabled={!form.name || !form.phone || !form.petName || submitting}
            onClick={handleConfirm}
            style={form.name && form.phone && form.petName && !submitting ? btnPrimary : btnDisabled}
          >
            {submitting ? "Enviando..." : "Confirmar agendamento"}
          </button>
        </div>
      )}
    </ModalShell>
  );
}

function ModalShell({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(24,36,26,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(24,36,26,0.25)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 18, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: TEXT_MUTED, lineHeight: 1 }}>✕</button>
        {children}
      </div>
    </div>
  );
}

export const PRIMARY = "#2F5233";
export const ACCENT = "#C97B4A";
export const TEXT_MUTED = "#7A8B7D";
export const BORDER = "#DCE5D6";
export const BG_PAGE = "#FBF6EF";
export const BG_CARD = "#F6F1E7";

const btnPrimary = {
  background: `linear-gradient(135deg, ${PRIMARY}, #1F3A24)`, color: "#fff", border: "none",
  padding: "12px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14,
  cursor: "pointer", boxShadow: `0 4px 14px ${PRIMARY}4D`,
};

const btnDisabled = {
  background: BORDER, color: "#9CAE96", border: "none",
  padding: "12px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "not-allowed",
};

const backBtn = { background: "none", border: "none", color: PRIMARY, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 16, display: "block" };
const modalTitle = { fontSize: 18, fontWeight: 700, color: PRIMARY, marginBottom: 14 };
const modalSub = { fontSize: 13, color: TEXT_MUTED, marginBottom: 14 };
const fieldLabel = { display: "block", fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginBottom: 5 };
const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
  fontSize: 14, color: PRIMARY, outline: "none", fontFamily: "Inter, sans-serif", background: BG_PAGE, boxSizing: "border-box",
};
