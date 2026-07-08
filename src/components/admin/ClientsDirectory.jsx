import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d} ${months[parseInt(m, 10) - 1]}`;
}

const EMPTY_PET_FORM = { name: "", species: "Cachorro", breed: "", next_grooming_due: "", next_vaccine_due: "", restrictions: "", vaccination_notes: "" };

export default function ClientsDirectory() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);
  const [petForm, setPetForm] = useState(EMPTY_PET_FORM);
  const [savingPet, setSavingPet] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("pn_clients").select("*").order("name");
    setClients(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [clients, search]);

  async function toggleExpand(client) {
    if (expandedId === client.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(client.id);
    setLoadingDetail(true);
    const [{ data: pets }, { data: appointments }, { data: orders }] = await Promise.all([
      supabase.from("pn_pets").select("*").eq("client_id", client.id).order("name"),
      supabase.from("pn_appointments").select("*, pn_time_slots(*), pn_services(*)").eq("client_id", client.id).order("created_at", { ascending: false }),
      supabase.from("pn_orders").select("*").eq("client_id", client.id).order("created_at", { ascending: false }),
    ]);
    setDetail({ pets: pets || [], appointments: appointments || [], orders: orders || [] });
    setLoadingDetail(false);
  }

  function startEditPet(p) {
    setEditingPetId(p.id);
    setPetForm({
      name: p.name,
      species: p.species || "Cachorro",
      breed: p.breed || "",
      next_grooming_due: p.next_grooming_due || "",
      next_vaccine_due: p.next_vaccine_due || "",
      restrictions: p.restrictions || "",
      vaccination_notes: p.vaccination_notes || "",
    });
  }

  function cancelEditPet() {
    setEditingPetId(null);
    setPetForm(EMPTY_PET_FORM);
  }

  async function savePet() {
    setSavingPet(true);
    const payload = {
      name: petForm.name.trim(),
      species: petForm.species,
      breed: petForm.breed.trim() || null,
      next_grooming_due: petForm.next_grooming_due || null,
      next_vaccine_due: petForm.next_vaccine_due || null,
      restrictions: petForm.restrictions.trim() || null,
      vaccination_notes: petForm.vaccination_notes.trim() || null,
    };
    await supabase.from("pn_pets").update(payload).eq("id", editingPetId);
    const { data: pets } = await supabase.from("pn_pets").select("*").eq("client_id", expandedId).order("name");
    setDetail((prev) => ({ ...prev, pets: pets || [] }));
    setSavingPet(false);
    cancelEditPet();
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#2F5233", marginBottom: 6 }}>Clientes & Pets</h1>
      <p style={{ fontSize: 13, color: "#7A8B7D", marginBottom: 20 }}>Histórico completo de agendamentos e pedidos por tutor, unificado pelo telefone.</p>

      <input
        placeholder="Buscar por nome ou telefone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: "100%", maxWidth: 340, padding: "10px 14px", borderRadius: 8, border: "1.5px solid #DCE5D6", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 20 }}
      />

      {loading ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Carregando...</p>
      ) : visible.length === 0 ? (
        <p style={{ color: "#7A8B7D", fontSize: 14 }}>Nenhum cliente encontrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((c) => (
            <div key={c.id} style={{ background: "#fff", border: "1px solid #E5EEE1", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2F5233" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#7A8B7D" }}>{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                </div>
                <button onClick={() => toggleExpand(c)} style={{ background: "none", border: "none", fontSize: 13, color: "#2F5233", cursor: "pointer", fontWeight: 600 }}>
                  {expandedId === c.id ? "Ocultar" : "Ver histórico"}
                </button>
              </div>

              {expandedId === c.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #E5EEE1" }}>
                  {loadingDetail ? (
                    <p style={{ color: "#7A8B7D", fontSize: 13 }}>Carregando histórico...</p>
                  ) : (
                    <>
                      <DetailSection title="🐾 Pets">
                        {detail.pets.length === 0 ? (
                          <p style={emptyText}>Nenhum pet cadastrado ainda.</p>
                        ) : (
                          detail.pets.map((p) =>
                            editingPetId === p.id ? (
                              <div key={p.id} style={petFormBox}>
                                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                  <input placeholder="Nome do pet" value={petForm.name} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} style={petInput} />
                                  <select value={petForm.species} onChange={(e) => setPetForm({ ...petForm, species: e.target.value })} style={petInput}>
                                    <option>Cachorro</option>
                                    <option>Gato</option>
                                    <option>Outro</option>
                                  </select>
                                  <input placeholder="Raça" value={petForm.breed} onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })} style={petInput} />
                                </div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                  <div style={{ flex: "1 1 160px" }}>
                                    <label style={petLabel}>Próximo banho/tosa</label>
                                    <input type="date" value={petForm.next_grooming_due} onChange={(e) => setPetForm({ ...petForm, next_grooming_due: e.target.value })} style={petInput} />
                                  </div>
                                  <div style={{ flex: "1 1 160px" }}>
                                    <label style={petLabel}>Próxima vacina</label>
                                    <input type="date" value={petForm.next_vaccine_due} onChange={(e) => setPetForm({ ...petForm, next_vaccine_due: e.target.value })} style={petInput} />
                                  </div>
                                </div>
                                <input placeholder="Restrições (alergias, comportamento...)" value={petForm.restrictions} onChange={(e) => setPetForm({ ...petForm, restrictions: e.target.value })} style={{ ...petInput, width: "100%", marginBottom: 8, boxSizing: "border-box" }} />
                                <input placeholder="Notas de vacinação" value={petForm.vaccination_notes} onChange={(e) => setPetForm({ ...petForm, vaccination_notes: e.target.value })} style={{ ...petInput, width: "100%", marginBottom: 10, boxSizing: "border-box" }} />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={savePet} disabled={savingPet || !petForm.name} style={petSaveBtn}>{savingPet ? "Salvando..." : "Salvar"}</button>
                                  <button onClick={cancelEditPet} style={petCancelBtn}>Cancelar</button>
                                </div>
                              </div>
                            ) : (
                              <div key={p.id} style={detailRow}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                  <div>
                                    <strong>{p.name}</strong> · {p.species}{p.breed ? ` · ${p.breed}` : ""}
                                    {p.restrictions && <div style={{ fontSize: 12, color: "#C0392B", marginTop: 2 }}>⚠️ {p.restrictions}</div>}
                                    {p.vaccination_notes && <div style={{ fontSize: 12, color: "#7A8B7D", marginTop: 2 }}>💉 {p.vaccination_notes}</div>}
                                    <div style={{ fontSize: 12, color: "#7A8B7D", marginTop: 2 }}>
                                      🛁 Próximo banho: {p.next_grooming_due ? formatDate(p.next_grooming_due) : "não definido"} · 💉 Próxima vacina: {p.next_vaccine_due ? formatDate(p.next_vaccine_due) : "não definida"}
                                    </div>
                                  </div>
                                  <button onClick={() => startEditPet(p)} style={{ background: "none", border: "none", fontSize: 12, color: "#2F5233", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                                    ✏️ Editar
                                  </button>
                                </div>
                              </div>
                            )
                          )
                        )}
                      </DetailSection>

                      <DetailSection title="🗓️ Agendamentos">
                        {detail.appointments.length === 0 ? (
                          <p style={emptyText}>Nenhum agendamento ainda.</p>
                        ) : (
                          detail.appointments.map((a) => (
                            <div key={a.id} style={detailRow}>
                              {formatDate(a.pn_time_slots?.slot_date)} · {a.pn_services?.name} · <em>{a.status}</em>
                            </div>
                          ))
                        )}
                      </DetailSection>

                      <DetailSection title="🛍️ Pedidos" last>
                        {detail.orders.length === 0 ? (
                          <p style={emptyText}>Nenhum pedido ainda.</p>
                        ) : (
                          detail.orders.map((o) => (
                            <div key={o.id} style={detailRow}>
                              Pedido #{o.id} · R$ {Number(o.total).toFixed(2).replace(".", ",")} · <em>{o.status}</em>
                            </div>
                          ))
                        )}
                      </DetailSection>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#4A5B45", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

const detailRow = { fontSize: 13, color: "#2F5233", padding: "6px 10px", background: "#F6F1E7", borderRadius: 8, marginBottom: 6 };
const emptyText = { fontSize: 12, color: "#7A8B7D", margin: 0 };
const petFormBox = { background: "#F6F1E7", border: "1px solid #DCE5D6", borderRadius: 10, padding: 12, marginBottom: 6 };
const petInput = { flex: "1 1 120px", padding: "7px 10px", borderRadius: 8, border: "1.5px solid #DCE5D6", fontSize: 12, outline: "none", fontFamily: "inherit", background: "#fff" };
const petLabel = { display: "block", fontSize: 11, fontWeight: 600, color: "#4A5B45", marginBottom: 3 };
const petSaveBtn = { background: "#2F5233", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const petCancelBtn = { background: "#fff", color: "#4A5B45", border: "1px solid #DCE5D6", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
