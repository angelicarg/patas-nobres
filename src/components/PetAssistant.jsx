import { useState, useEffect, useRef } from "react";
import { PRIMARY, ACCENT, TEXT_MUTED, BORDER, BG_PAGE } from "./BookingModal";

const QUICK = ["Recomendação de ração 🍖", "Brinquedo para gato 🧸", "Petiscos naturais 🥩", "Produtos para pelo longo ✂️"];

export default function PetAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Oi! 🐾 Sou a assistente da Patas Nobres. Posso recomendar produtos da loja pra o seu pet — me conta um pouco sobre ele (espécie, raça, alguma restrição) e o que você procura." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [profileOpen, setProfileOpen] = useState(true);
  const [petProfile, setPetProfile] = useState({ species: "", breed: "", restrictions: "" });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          petProfile,
        }),
      });

      const data = await response.json();

      if (data.error === "rate_limited") {
        setMessages((prev) => [...prev, { role: "assistant", content: "Recebi muitas mensagens agora, respira um pouquinho e tenta de novo! 🐾" }]);
        return;
      }

      const reply = data.reply || "Desculpa, tive um probleminha aqui. Tenta de novo em instantes! 😅";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (!open) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Ops, algo deu errado. Me chama no WhatsApp da loja! 🐾" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 500,
          width: 60, height: 60, borderRadius: "50%", border: "none",
          background: `linear-gradient(135deg, ${PRIMARY}, #1F3A24)`,
          color: "#fff", fontSize: 26, cursor: "pointer",
          boxShadow: `0 6px 24px ${PRIMARY}80`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title="Falar com a assistente"
      >
        {open ? "✕" : "🐾"}
        {!open && unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, background: ACCENT, color: "#fff", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "fixed", bottom: 100, right: 28, zIndex: 499, width: "min(380px, calc(100vw - 32px))", background: BG_PAGE, borderRadius: 20, boxShadow: `0 20px 60px ${PRIMARY}40`, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", maxHeight: "75vh" }}>
          <div style={{ background: `linear-gradient(135deg, ${PRIMARY}, #1F3A24)`, borderRadius: "20px 20px 0 0", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(201,123,74,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🐾</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>Assistente Patas Nobres</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Recomendações personalizadas</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 6px #4CAF50" }} />
          </div>

          <div style={{ borderBottom: `1px solid ${BORDER}` }}>
            <button onClick={() => setProfileOpen((o) => !o)} style={{ width: "100%", background: "none", border: "none", padding: "10px 16px", fontSize: 12, fontWeight: 700, color: PRIMARY, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              🐕 Perfil do pet (opcional) {profileOpen ? "▲" : "▼"}
            </button>
            {profileOpen && (
              <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={petProfile.species} onChange={(e) => setPetProfile({ ...petProfile, species: e.target.value })} style={miniInput}>
                    <option value="">Espécie</option>
                    <option>Cachorro</option>
                    <option>Gato</option>
                    <option>Outro</option>
                  </select>
                  <input placeholder="Raça" value={petProfile.breed} onChange={(e) => setPetProfile({ ...petProfile, breed: e.target.value })} style={miniInput} />
                </div>
                <input placeholder="Restrições/observações" value={petProfile.restrictions} onChange={(e) => setPetProfile({ ...petProfile, restrictions: e.target.value })} style={miniInput} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${PRIMARY}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>🐾</div>
                )}
                <div style={{
                  maxWidth: "78%",
                  background: m.role === "user" ? `linear-gradient(135deg, ${PRIMARY}, #1F3A24)` : "#fff",
                  color: m.role === "user" ? "#fff" : PRIMARY,
                  padding: "10px 14px",
                  borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  fontSize: 13.5, lineHeight: 1.55,
                  border: m.role === "assistant" ? `1px solid ${BORDER}` : "none",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${PRIMARY}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🐾</div>
                <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: "4px 16px 16px 16px", padding: "10px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map((d) => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: PRIMARY, opacity: 0.6 }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 2 && (
            <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {QUICK.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} style={{ background: "#F6F1E7", border: `1px solid ${BORDER}`, borderRadius: 100, padding: "6px 12px", fontSize: 12, color: TEXT_MUTED, cursor: "pointer" }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div style={{ padding: "10px 14px 14px", display: "flex", gap: 8, borderTop: `1px solid ${BORDER}` }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Digite sua mensagem..."
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 13, outline: "none", fontFamily: "inherit" }}
            />
            <button onClick={() => sendMessage()} disabled={loading} style={{ background: PRIMARY, color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 15, cursor: loading ? "wait" : "pointer" }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const miniInput = { flex: 1, padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${BORDER}`, fontSize: 12, outline: "none", fontFamily: "inherit", background: "#fff", boxSizing: "border-box" };
