-- Patas Nobres — schema, security policies and seed data.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- NOTE: This project shares a Supabase project with Dente Vivo (free-tier
-- account is capped at 2 projects). Every table/function is prefixed with
-- `pn_` to avoid colliding with Dente Vivo's own `time_slots`/`appointments`
-- tables living in the same Postgres instance — same isolation-by-prefix
-- approach already used to add Clínica Visão Plena into Página Mágica's
-- Supabase project.

-- ─── TABLES ───────────────────────────────────────────────────────────────

-- Clients/pets are new relative to the sibling case projects (Dente Vivo,
-- Página Mágica): those capture name/phone inline per transaction with no
-- persistent identity. Patas Nobres needs pet history (vaccines,
-- restrictions) to accumulate across visits, plus a unified admin view of a
-- person's pets + bookings + orders — so `pn_clients.phone` is a natural
-- key that pn_book_appointment() and pn_create_order() both upsert into.

create table pn_clients (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null unique,
  email text,
  created_at timestamptz not null default now()
);

create table pn_pets (
  id bigint generated always as identity primary key,
  client_id bigint not null references pn_clients (id) on delete cascade,
  name text not null,
  species text not null,
  breed text,
  approx_age_text text,
  vaccination_notes text,
  restrictions text,
  next_grooming_due date,
  next_vaccine_due date,
  created_at timestamptz not null default now()
);

-- ─── BOOKING DOMAIN (mirrors Dente Vivo's dentists/time_slots/appointments)

create table pn_professionals (
  id bigint generated always as identity primary key,
  name text not null,
  role_title text not null,
  bio text not null,
  color text not null,
  initials text not null,
  active boolean not null default true
);

create table pn_services (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text not null,
  duration_minutes int not null default 60,
  price numeric(10,2) not null,
  active boolean not null default true
);

create table pn_time_slots (
  id bigint generated always as identity primary key,
  professional_id bigint not null references pn_professionals (id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  is_available boolean not null default true,
  blocked boolean not null default false,
  unique (professional_id, slot_date, slot_time)
);

create table pn_appointments (
  id bigint generated always as identity primary key,
  time_slot_id bigint not null unique references pn_time_slots (id) on delete cascade,
  service_id bigint not null references pn_services (id),
  client_id bigint not null references pn_clients (id),
  pet_id bigint not null references pn_pets (id),
  note text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now()
);

-- ─── LOJA DOMAIN (mirrors Página Mágica's products/orders/order_items)

create table pn_products (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null,
  category text not null,
  price numeric(10,2) not null,
  stock int not null default 0,
  cover_emoji text not null,
  cover_color text not null,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table pn_orders (
  id bigint generated always as identity primary key,
  client_id bigint references pn_clients (id),
  customer_name text not null,
  customer_phone text not null,
  total numeric(10,2) not null,
  status text not null default 'recebido' check (status in ('recebido', 'preparando', 'concluido')),
  created_at timestamptz not null default now()
);

create table pn_order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references pn_orders (id) on delete cascade,
  product_id bigint references pn_products (id) on delete set null,
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null
);

-- ─── REMINDERS (simulated only — no Twilio/WhatsApp Business API here) ────

create table pn_reminders (
  id bigint generated always as identity primary key,
  pet_id bigint not null references pn_pets (id) on delete cascade,
  type text not null check (type in ('grooming', 'vaccine')),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'sent_simulated')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────
-- Tighter than both sibling projects: pn_clients/pn_pets carry phone/email/
-- health notes (fictional data, but still PII-shaped), so anon gets NO
-- policy at all on pn_clients, pn_pets, pn_appointments, pn_orders,
-- pn_order_items or pn_reminders — every public write goes exclusively
-- through the two security-definer functions below, which bypass RLS
-- internally. There is no anon read path into any of those six tables.
--
-- `authenticated` policies below apply to ANY logged-in user in this shared
-- Supabase project (including Dente Vivo's own admin account) — same
-- accepted tradeoff already in place for Clínica Visão Plena sharing
-- Página Mágica's project. Give Patas Nobres its own Supabase Auth user
-- rather than reusing Dente Vivo's, to keep admin logins app-scoped even
-- though the RLS policy itself doesn't enforce that boundary.

alter table pn_clients enable row level security;
alter table pn_pets enable row level security;
alter table pn_professionals enable row level security;
alter table pn_services enable row level security;
alter table pn_time_slots enable row level security;
alter table pn_appointments enable row level security;
alter table pn_products enable row level security;
alter table pn_orders enable row level security;
alter table pn_order_items enable row level security;
alter table pn_reminders enable row level security;

create policy "public read pn_professionals" on pn_professionals
  for select using (active);

create policy "admin manage pn_professionals" on pn_professionals
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read pn_services" on pn_services
  for select using (active);

create policy "admin manage pn_services" on pn_services
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read pn_time_slots" on pn_time_slots
  for select using (true);

create policy "admin manage pn_time_slots" on pn_time_slots
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public read pn_products" on pn_products
  for select using (active);

create policy "admin manage pn_products" on pn_products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage pn_clients" on pn_clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage pn_pets" on pn_pets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage pn_appointments" on pn_appointments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage pn_orders" on pn_orders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage pn_order_items" on pn_order_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "admin manage pn_reminders" on pn_reminders
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ─── BOOKING FUNCTION ─────────────────────────────────────────────────────
-- Extends Dente Vivo's book_appointment(): row-locks the slot, upserts the
-- client by phone (so repeat customers converge under one record), reuses
-- an existing pet or creates a new one, then creates the appointment.

create or replace function pn_book_appointment(
  p_slot_id bigint,
  p_service_id bigint,
  p_client_name text,
  p_client_phone text,
  p_client_email text default null,
  p_pet_id bigint default null,
  p_pet_name text default null,
  p_pet_species text default null,
  p_pet_breed text default null,
  p_pet_notes text default null,
  p_note text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available boolean;
  v_client_id bigint;
  v_pet_id bigint;
  v_appointment_id bigint;
  v_phone text := regexp_replace(p_client_phone, '\D', '', 'g');
begin
  select is_available into v_available from pn_time_slots where id = p_slot_id for update;

  if v_available is null then
    raise exception 'Horário não encontrado';
  end if;

  if not v_available then
    raise exception 'Este horário já foi reservado';
  end if;

  insert into pn_clients (name, phone, email)
  values (p_client_name, v_phone, p_client_email)
  on conflict (phone) do update
    set name = excluded.name, email = coalesce(excluded.email, pn_clients.email)
  returning id into v_client_id;

  if p_pet_id is not null then
    select id into v_pet_id from pn_pets where id = p_pet_id and client_id = v_client_id;
    if v_pet_id is null then
      raise exception 'Pet não pertence a este tutor';
    end if;
  else
    insert into pn_pets (client_id, name, species, breed, vaccination_notes)
    values (v_client_id, p_pet_name, p_pet_species, p_pet_breed, p_pet_notes)
    returning id into v_pet_id;
  end if;

  update pn_time_slots set is_available = false where id = p_slot_id;

  insert into pn_appointments (time_slot_id, service_id, client_id, pet_id, note)
  values (p_slot_id, p_service_id, v_client_id, v_pet_id, p_note)
  returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

grant execute on function pn_book_appointment(bigint, bigint, text, text, text, bigint, text, text, text, text, text) to anon;

-- ─── ORDER FUNCTION ───────────────────────────────────────────────────────
-- Same pattern as Página Mágica's create_order(): prices looked up
-- server-side from `pn_products`, total computed here, stock decremented
-- atomically — plus the same phone-based client upsert as
-- pn_book_appointment, so a customer's grooming visits and shop orders
-- converge under one `pn_clients` row with no login required.

create or replace function pn_create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_items jsonb -- [{ "product_id": 1, "quantity": 2 }, ...]
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_client_id bigint;
  v_total numeric(10,2) := 0;
  v_item jsonb;
  v_product pn_products%rowtype;
  v_phone text := regexp_replace(p_customer_phone, '\D', '', 'g');
begin
  if jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido está vazio';
  end if;

  insert into pn_clients (name, phone, email)
  values (p_customer_name, v_phone, p_customer_email)
  on conflict (phone) do update
    set name = excluded.name, email = coalesce(excluded.email, pn_clients.email)
  returning id into v_client_id;

  insert into pn_orders (client_id, customer_name, customer_phone, total)
  values (v_client_id, p_customer_name, v_phone, 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from pn_products where id = (v_item->>'product_id')::bigint for update;

    if v_product.id is null then
      raise exception 'Produto não encontrado';
    end if;

    insert into pn_order_items (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, (v_item->>'quantity')::int, v_product.price);

    v_total := v_total + v_product.price * (v_item->>'quantity')::int;

    update pn_products set stock = greatest(stock - (v_item->>'quantity')::int, 0) where id = v_product.id;
  end loop;

  update pn_orders set total = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function pn_create_order(text, text, text, jsonb) to anon;

-- ─── AUTO-GENERATED SLOTS ─────────────────────────────────────────────────
-- Keeps a rolling 25-day window of grooming slots topped up, same pattern
-- as Dente Vivo's generate_upcoming_slots(). Safe to run repeatedly
-- (ON CONFLICT DO NOTHING).

create or replace function pn_generate_upcoming_grooming_slots() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pn_time_slots (professional_id, slot_date, slot_time)
  select p.id, day::date, t.slot_time
  from pn_professionals p
  cross join lateral (
    select generate_series(
      date_trunc('day', now()) + interval '1 day',
      date_trunc('day', now()) + interval '25 day',
      interval '1 day'
    ) as day
  ) days
  cross join lateral (
    select unnest(array['09:00','10:00','11:00','14:00','15:00','16:00']::time[]) as slot_time
  ) t
  where p.active
    and extract(isodow from day) < 6
    and mod((p.id + extract(day from day)::int + extract(hour from t.slot_time)::int), 3) != 0
  on conflict (professional_id, slot_date, slot_time) do nothing;
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pn-generate-upcoming-grooming-slots-daily') then
    perform cron.unschedule('pn-generate-upcoming-grooming-slots-daily');
  end if;
end;
$$;

select cron.schedule(
  'pn-generate-upcoming-grooming-slots-daily',
  '0 3 * * *',
  $$select pn_generate_upcoming_grooming_slots()$$
);

-- ─── SEED DATA ────────────────────────────────────────────────────────────

insert into pn_professionals (name, role_title, bio, color, initials) values
  ('Bianca Prado', 'Tosadora sênior', 'Especialista em tosa na tesoura e acabamento de raças de pelo longo, com mais de 8 anos de experiência.', '#2F5233', 'BP'),
  ('Diego Alcântara', 'Banhista e tosador', 'Cuidadoso com pets ansiosos, referência em banho terapêutico e hidratação.', '#C97B4A', 'DA'),
  ('Rafaela Nunes', 'Tosadora', 'Focada em tosa higiênica e styling para exposições e eventos.', '#7A8B7D', 'RN');

insert into pn_services (slug, name, description, duration_minutes, price) values
  ('banho', 'Banho completo', 'Banho com produtos hipoalergênicos, secagem e escovação.', 45, 60.00),
  ('tosa-higienica', 'Tosa higiênica', 'Aparo de patas, região íntima e face, sem alterar o corte geral.', 30, 40.00),
  ('tosa-tesoura', 'Tosa na tesoura', 'Corte completo à tesoura, com acabamento personalizado por raça.', 90, 120.00),
  ('hidratacao', 'Hidratação', 'Tratamento de pelo e pele com máscara hidratante e escovação profunda.', 40, 55.00);

-- Generates a handful of open slots per professional for the next 15
-- weekdays, thinning them out with a deterministic modulo so it looks like
-- a real, partially-booked calendar instead of every slot being open.
insert into pn_time_slots (professional_id, slot_date, slot_time)
select p.id, day::date, t.slot_time
from pn_professionals p
cross join lateral (
  select generate_series(
    date_trunc('day', now()) + interval '1 day',
    date_trunc('day', now()) + interval '18 day',
    interval '1 day'
  ) as day
) days
cross join lateral (
  select unnest(array['09:00','10:00','11:00','14:00','15:00','16:00']::time[]) as slot_time
) t
where extract(isodow from day) < 6
  and mod((p.id + extract(day from day)::int + extract(hour from t.slot_time)::int), 3) != 0;

insert into pn_products (name, description, category, price, stock, cover_emoji, cover_color, featured) values
  ('Ração Premium Cães Adultos 15kg', 'Fórmula completa com proteína de frango e ômega 6 para pelo brilhante.', 'Ração', 189.90, 24, '🦴', '#C97B4A', true),
  ('Ração Premium Gatos Castrados 3kg', 'Baixa caloria, indicada para controle de peso em gatos castrados.', 'Ração', 79.90, 30, '🐟', '#7A8B7D', false),
  ('Ração Filhotes Cães Pequeno Porte 3kg', 'Alto teor calórico para o desenvolvimento saudável de filhotes.', 'Ração', 69.90, 20, '🍖', '#C97B4A', false),
  ('Petisco Natural Bifinho 200g', 'Bifinho 100% carne bovina desidratada, sem conservantes.', 'Petiscos', 24.90, 45, '🥩', '#B85C38', true),
  ('Petisco Dental Stick (kit 6un)', 'Ajuda na limpeza dos dentes e combate ao mau hálito.', 'Petiscos', 32.90, 38, '🦷', '#B85C38', false),
  ('Coleira Ajustável Nylon', 'Coleira resistente com fivela de segurança, tamanhos P/M/G.', 'Acessórios', 39.90, 26, '🎗️', '#2F5233', false),
  ('Guia Retrátil 5m', 'Guia retrátil com trava e cabo reforçado para até 30kg.', 'Acessórios', 64.90, 18, '🪢', '#2F5233', false),
  ('Caminha Ortopédica P', 'Espuma de alta densidade, capa removível e lavável.', 'Acessórios', 149.90, 12, '🛏️', '#8C6A4F', true),
  ('Brinquedo Mordedor Kong', 'Borracha resistente, ideal para recheio com petiscos.', 'Brinquedos', 44.90, 22, '🧸', '#C97B4A', false),
  ('Arranhador para Gatos Torre', 'Torre de sisal com plataforma e bolinha suspensa.', 'Brinquedos', 129.90, 10, '🐈', '#7A8B7D', false),
  ('Shampoo Neutro 500ml', 'Shampoo suave para uso frequente, pH balanceado para pele sensível.', 'Higiene', 34.90, 28, '🧴', '#47747A', false),
  ('Areia Higiênica Aglomerante 4kg', 'Controle de odor por até 7 dias, baixa formação de poeira.', 'Higiene', 42.90, 33, '🐾', '#7A8B7D', false),
  ('Escova Removedora de Pelos', 'Remove pelos soltos e subpelo sem machucar a pele.', 'Higiene', 29.90, 20, '🪮', '#47747A', false),
  ('Comedouro Antiengasgo', 'Reduz a velocidade da alimentação e melhora a digestão.', 'Acessórios', 54.90, 16, '🥣', '#2F5233', false);

select pn_generate_upcoming_grooming_slots();
