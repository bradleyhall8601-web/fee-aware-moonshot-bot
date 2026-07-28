-- MoonShotForge Vercel + Supabase production schema
-- No VPS, PM2, persistent local process, or SQLite production database.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings(key, value) values
  ('paper_trading_only', 'true'::jsonb),
  ('enable_live_trading', 'false'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function public.enforce_paper_only_settings()
returns trigger
language plpgsql
as $$
begin
  if new.key = 'paper_trading_only' and new.value <> 'true'::jsonb then
    raise exception 'PAPER_TRADING_ONLY cannot be disabled';
  end if;
  if new.key = 'enable_live_trading' and new.value <> 'false'::jsonb then
    raise exception 'ENABLE_LIVE_TRADING cannot be enabled';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_paper_only_settings_trigger on public.system_settings;
create trigger enforce_paper_only_settings_trigger
before insert or update on public.system_settings
for each row execute function public.enforce_paper_only_settings();

create table if not exists public.bot_users (
  telegram_id text primary key,
  chat_id text not null,
  username text,
  first_name text,
  is_owner boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_updates (
  update_id bigint primary key,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz
);
alter table public.telegram_updates add column if not exists processing_started_at timestamptz;

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  category text not null,
  action text not null,
  severity text not null default 'info' check (severity in ('debug','info','warn','error')),
  actor text not null default 'system',
  payload jsonb not null default '{}'::jsonb
);
create index if not exists activity_log_time_idx on public.activity_log(occurred_at desc);
create index if not exists activity_log_category_idx on public.activity_log(category, id desc);

create table if not exists public.boss_cursors (
  telegram_id text primary key,
  last_activity_id bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  candidate_id text primary key,
  observed_at timestamptz not null,
  mint text not null,
  pair_address text not null,
  symbol text not null,
  name text not null,
  dex_id text not null,
  price_usd numeric not null,
  liquidity_usd numeric not null,
  volume_5m_usd numeric not null,
  volume_1h_usd numeric not null,
  pool_age_ms bigint not null,
  valid boolean not null default false,
  winning_strategy text check (winning_strategy is null or winning_strategy in ('SNIPER','SCALP','RIDE')),
  winning_score numeric,
  rejection_codes text[] not null default '{}',
  source text[] not null default '{}',
  raw_market jsonb not null default '{}'::jsonb,
  safety jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists candidates_mint_time_idx on public.candidates(mint, observed_at desc);
create index if not exists candidates_valid_time_idx on public.candidates(valid, observed_at desc);

create table if not exists public.strategy_scores (
  candidate_id text not null references public.candidates(candidate_id) on delete cascade,
  strategy text not null check (strategy in ('SNIPER','SCALP','RIDE')),
  score numeric not null,
  threshold numeric not null,
  qualified boolean not null,
  incomplete boolean not null,
  missing_fields text[] not null default '{}',
  rejection_codes text[] not null default '{}',
  components jsonb not null default '{}'::jsonb,
  score_version text not null,
  scored_at timestamptz not null,
  primary key(candidate_id, strategy)
);
create index if not exists strategy_scores_rank_idx on public.strategy_scores(strategy, qualified, score desc);

create table if not exists public.strategy_runtime (
  strategy text primary key check (strategy in ('SNIPER','SCALP','RIDE')),
  enabled boolean not null default true,
  consecutive_losses integer not null default 0,
  daily_entries integer not null default 0,
  daily_pnl_usd numeric not null default 0,
  runtime_day date not null default (now() at time zone 'utc')::date,
  paused_until timestamptz,
  last_outcome text,
  updated_at timestamptz not null default now()
);
insert into public.strategy_runtime(strategy) values ('SNIPER'),('SCALP'),('RIDE') on conflict do nothing;

create table if not exists public.strategy_config (
  strategy text primary key check (strategy in ('SNIPER','SCALP','RIDE')),
  min_score numeric not null check (min_score between 0 and 100),
  paper_notional_usd numeric not null check (paper_notional_usd > 0 and paper_notional_usd <= 10000),
  stop_loss_pct numeric not null check (stop_loss_pct < 0),
  take_profit_pct numeric not null check (take_profit_pct > 0),
  trail_activate_pct numeric not null check (trail_activate_pct > 0),
  trailing_pct numeric not null check (trailing_pct > 0),
  max_hold_minutes integer not null check (max_hold_minutes between 1 and 10080),
  max_daily_entries integer not null check (max_daily_entries between 1 and 1000),
  max_daily_entries_per_mint integer not null check (max_daily_entries_per_mint between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.strategy_config(
  strategy,min_score,paper_notional_usd,stop_loss_pct,take_profit_pct,
  trail_activate_pct,trailing_pct,max_hold_minutes,max_daily_entries,max_daily_entries_per_mint
) values
  ('SNIPER',70,20,-5,18,8,4,8,20,2),
  ('SCALP',72,20,-4,12,7,3,25,20,2),
  ('RIDE',74,20,-8,35,15,8,360,20,2)
on conflict (strategy) do nothing;

create table if not exists public.signals (
  signal_id text primary key,
  candidate_id text not null references public.candidates(candidate_id),
  strategy text not null check (strategy in ('SNIPER','SCALP','RIDE')),
  score numeric not null,
  symbol text not null,
  name text not null,
  mint text not null,
  pair_address text not null,
  status text not null default 'paper_opened' check (status in ('paper_opened','paper_closed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists signals_time_idx on public.signals(created_at desc);

create table if not exists public.paper_positions (
  id uuid primary key default gen_random_uuid(),
  signal_id text not null unique references public.signals(signal_id),
  candidate_id text not null references public.candidates(candidate_id),
  strategy text not null check (strategy in ('SNIPER','SCALP','RIDE')),
  symbol text not null,
  name text not null,
  mint text not null,
  pair_address text not null,
  status text not null default 'open' check (status in ('open','closed')),
  entry_price numeric not null check (entry_price > 0),
  current_price numeric not null check (current_price > 0),
  highest_price numeric not null check (highest_price > 0),
  exit_price numeric,
  quantity numeric not null check (quantity > 0),
  notional_usd numeric not null check (notional_usd > 0),
  pnl_usd numeric not null default 0,
  pnl_pct numeric not null default 0,
  exit_reason text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists paper_positions_status_idx on public.paper_positions(status, opened_at desc);
create index if not exists paper_positions_mint_idx on public.paper_positions(mint, status);

create table if not exists public.job_leases (
  job_name text primary key,
  run_id text not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.job_runs (
  id text primary key,
  job_name text not null,
  status text not null check (status in ('running','success','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb
);
create index if not exists job_runs_name_time_idx on public.job_runs(job_name, started_at desc);

