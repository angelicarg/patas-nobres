# Patas Nobres

Pet shop fictício — banho e tosa com agendamento online, loja de produtos, painel administrativo e assistente de IA com recomendação de produtos. 7º case do portfólio da Aruanã Digital, exemplo do pacote Avançado.

## Stack

React 19 + Vite + React Router + Supabase (Postgres + Auth + RLS) + Vercel (hosting + serverless function para a IA).

## Setup local

```bash
npm install
cp .env.example .env   # preencher com as credenciais do projeto Supabase e a chave da Anthropic
npm run dev
```

## Banco de dados

Rode `supabase/schema.sql` uma vez no SQL Editor do Supabase (Project → SQL Editor → New query). O arquivo cria as tabelas, políticas de RLS, as funções `book_appointment`/`create_order`, o job de `pg_cron` que mantém a agenda de banho/tosa sempre com 25 dias de horários abertos, e os dados de seed (profissionais, serviços e produtos).

## Variáveis de ambiente

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — projeto Supabase dedicado (não reutilizar o de outro case, para não colidir nomes de tabela).
- `ANTHROPIC_API_KEY` — usada só no servidor, pela função serverless `api/assistant.js`. Nunca exposta ao cliente.

## Painel administrativo

- URL: `/admin/login`
- Crie um usuário no Supabase Auth (Authentication → Users → Add user, com "Auto Confirm").

## Estrutura

- `src/pages/PublicSite.jsx` — landing, serviços, loja/carrinho/checkout.
- `src/components/BookingModal.jsx` — wizard de agendamento (serviço → profissional/horário → tutor e pet → confirmação).
- `src/components/PetAssistant.jsx` + `api/assistant.js` — assistente de IA (Claude Haiku) com recomendação de produtos baseada no perfil do pet informado na conversa.
- `src/pages/AdminDashboard.jsx` + `src/components/admin/*` — agenda, loja e diretório de clientes/pets com histórico unificado (por telefone).

## Lembretes por WhatsApp

Os lembretes de banho/tosa e vacina são **simulados** no painel administrativo (aba Lembretes) — não há integração real com Twilio/WhatsApp Business API nesta demo.
