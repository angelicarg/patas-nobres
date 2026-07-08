// Vercel serverless function — keeps the Anthropic API key server-side and
// puts a bound on spend for this public, unauthenticated endpoint.
//
// Same pattern as Página Mágica's "Nina" (api/chat.js): the product catalog
// is fetched from Supabase on every request, so editing a product in the
// admin panel updates what the assistant recommends without touching this
// code. Unlike Nina, this endpoint also takes a `petProfile` supplied by the
// client in the same chat session — it does NOT read the `pets` table
// server-side, because RLS deliberately gives `anon` no read path into pets
// at all (pets carry phone/health-adjacent data even as fictional demo data).

import { createClient } from "@supabase/supabase-js";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 400;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 8;

const IP_WINDOW_MS = 60_000;
const IP_MAX_REQUESTS = 6;
const DAILY_MAX_REQUESTS = 300;

// In-memory only: resets on cold start and isn't shared across serverless
// instances, so this is a best-effort throttle, not a hard cap. Good enough
// until traffic justifies a real store (e.g. Upstash/Redis).
const ipHits = new Map();
let dailyCount = 0;
let dailyResetAt = nextMidnightUTC();

function nextMidnightUTC() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function isRateLimited(ip) {
  const now = Date.now();

  if (now >= dailyResetAt) {
    dailyCount = 0;
    dailyResetAt = nextMidnightUTC();
  }
  if (dailyCount >= DAILY_MAX_REQUESTS) return true;

  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_MAX_REQUESTS) {
    ipHits.set(ip, hits);
    return true;
  }

  hits.push(now);
  ipHits.set(ip, hits);
  dailyCount += 1;
  return false;
}

function isValidMessage(m) {
  return (
    m &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.length > 0 &&
    m.content.length <= MAX_MESSAGE_LENGTH
  );
}

function sanitizePetProfile(petProfile) {
  if (!petProfile || typeof petProfile !== "object") return null;
  const clean = (v) => (typeof v === "string" ? v.slice(0, 200) : "");
  const species = clean(petProfile.species);
  const breed = clean(petProfile.breed);
  const restrictions = clean(petProfile.restrictions);
  if (!species && !breed && !restrictions) return null;
  return { species, breed, restrictions };
}

async function buildSystemPrompt(petProfile) {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  let catalogText = "Catálogo indisponível no momento.";

  if (url && anonKey) {
    const supabase = createClient(url, anonKey);
    const { data: products } = await supabase
      .from("pn_products")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("name");

    if (products?.length) {
      const byCategory = {};
      for (const p of products) {
        (byCategory[p.category] ??= []).push(p);
      }
      catalogText = Object.entries(byCategory)
        .map(([category, items]) => {
          const lines = items.map((p) => {
            const stock = p.stock > 0 ? `${p.stock} em estoque` : "esgotado";
            return `  - ${p.name}: R$ ${Number(p.price).toFixed(2)} — ${stock}. ${p.description}`;
          });
          return `${category}:\n${lines.join("\n")}`;
        })
        .join("\n\n");
    }
  }

  const petText = petProfile
    ? `PERFIL DO PET INFORMADO PELO TUTOR NESTA CONVERSA:\n- Espécie: ${petProfile.species || "não informado"}\n- Raça: ${petProfile.breed || "não informado"}\n- Restrições/observações: ${petProfile.restrictions || "nenhuma informada"}`
    : "O tutor ainda não informou o perfil do pet — pergunte a espécie e eventuais restrições antes de recomendar produtos específicos.";

  return `Você é a assistente virtual da Patas Nobres, um pet shop completo com banho, tosa e loja de produtos. Você é gentil, direta e apaixonada por ajudar tutores a cuidar bem dos seus pets.

SOBRE A LOJA:
- Nome: Patas Nobres
- Endereço: Avenida Rondon Pacheco, 1500 — Umuarama, Uberlândia – MG
- Horário: Segunda a Sábado, das 8h às 18h
- WhatsApp: (34) 99765-4321

CATÁLOGO ATUAL (lido direto do banco de dados — sempre atualizado):

${catalogText}

${petText}

INSTRUÇÕES DE COMPORTAMENTO:
- Responda SEMPRE em português brasileiro
- Seja calorosa, use emojis com moderação (não exagere)
- Respostas curtas e diretas — máximo 3 parágrafos
- Recomende produtos com base no catálogo acima e no perfil do pet informado, nunca invente produtos que não estão na lista
- Se um produto estiver esgotado, avise e sugira uma alternativa parecida do catálogo
- Se o cliente quiser comprar, oriente a usar o carrinho no site ou o WhatsApp (34) 99765-4321
- Se a pergunta for sobre sintomas, diagnóstico ou tratamento médico do pet, oriente gentilmente a consultar um veterinário — você não dá orientação médica/veterinária
- Nunca invente informações que não estão neste contexto`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .toString()
    .split(",")[0]
    .trim();

  if (isRateLimited(ip)) {
    res.status(200).json({ error: "rate_limited" });
    return;
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isValidMessage)) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[assistant] ANTHROPIC_API_KEY not configured");
    res.status(200).json({ error: "unavailable" });
    return;
  }

  const petProfile = sanitizePetProfile(req.body?.petProfile);
  const history = messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content }));

  try {
    const systemPrompt = await buildSystemPrompt(petProfile);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: history,
      }),
    });

    if (!response.ok) {
      console.error("[assistant] Anthropic API error", response.status, await response.text());
      res.status(200).json({ error: "unavailable" });
      return;
    }

    const json = await response.json();
    const reply = json.content?.[0]?.text;
    if (!reply) {
      res.status(200).json({ error: "unavailable" });
      return;
    }

    res.status(200).json({ reply });
  } catch (err) {
    console.error("[assistant] request failed", err);
    res.status(200).json({ error: "unavailable" });
  }
}
