create or replace function public.create_signal_and_position(
  p_signal_id text,
  p_candidate_id text,
  p_strategy text,
  p_score numeric,
  p_symbol text,
  p_name text,
  p_mint text,
  p_pair_address text,
  p_entry_price numeric,
  p_notional_usd numeric,
  p_max_open_positions integer,
  p_max_daily_entries integer,
  p_max_daily_entries_per_mint integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runtime public.strategy_runtime%rowtype;
  v_open_count integer;
  v_mint_entries integer;
  v_position_id uuid;
  v_inserted integer;
  v_today date := (now() at time zone 'utc')::date;
begin
  if coalesce((select value::boolean from public.system_settings where key='paper_trading_only'), false) is not true
     or coalesce((select value::boolean from public.system_settings where key='enable_live_trading'), false) is true then
    return jsonb_build_object('created', false, 'reason', 'REJECTED_LIVE_TRADING_DISABLED');
  end if;
  if p_strategy not in ('SNIPER','SCALP','RIDE') or p_entry_price <= 0 or p_notional_usd <= 0
     or p_max_daily_entries_per_mint <= 0 then
    return jsonb_build_object('created', false, 'reason', 'invalid_input');
  end if;

  insert into public.strategy_runtime(strategy) values (p_strategy) on conflict do nothing;
  select * into v_runtime from public.strategy_runtime where strategy=p_strategy for update;
  if v_runtime.runtime_day <> v_today then
    update public.strategy_runtime
      set runtime_day=v_today, daily_entries=0, daily_pnl_usd=0, updated_at=now()
      where strategy=p_strategy
      returning * into v_runtime;
  end if;
  if not v_runtime.enabled then return jsonb_build_object('created', false, 'reason', 'REJECTED_STRATEGY_DISABLED'); end if;
  if v_runtime.paused_until is not null and v_runtime.paused_until > now() then
    return jsonb_build_object('created', false, 'reason', 'REJECTED_CIRCUIT_BREAKER');
  end if;
  if v_runtime.daily_entries >= p_max_daily_entries then
    return jsonb_build_object('created', false, 'reason', 'REJECTED_DAILY_LIMIT');
  end if;
  select count(*) into v_mint_entries
  from public.paper_positions
  where mint=p_mint and opened_at >= date_trunc('day',now() at time zone 'utc') at time zone 'utc';
  if v_mint_entries >= p_max_daily_entries_per_mint then
    return jsonb_build_object('created', false, 'reason', 'REJECTED_PER_MINT_DAILY_CAP');
  end if;

  select count(*) into v_open_count from public.paper_positions where status='open';
  if v_open_count >= p_max_open_positions then
    return jsonb_build_object('created', false, 'reason', 'REJECTED_MAX_EXPOSURE');
  end if;
  if exists(select 1 from public.paper_positions where mint=p_mint and status='open') then
    return jsonb_build_object('created', false, 'reason', 'REJECTED_DUPLICATE_POSITION');
  end if;

  insert into public.signals(signal_id,candidate_id,strategy,score,symbol,name,mint,pair_address,status)
  values(p_signal_id,p_candidate_id,p_strategy,p_score,p_symbol,p_name,p_mint,p_pair_address,'paper_opened')
  on conflict (signal_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return jsonb_build_object('created', false, 'reason', 'REJECTED_DUPLICATE_SIGNAL'); end if;

  insert into public.paper_positions(
    signal_id,candidate_id,strategy,symbol,name,mint,pair_address,
    entry_price,current_price,highest_price,quantity,notional_usd
  ) values (
    p_signal_id,p_candidate_id,p_strategy,p_symbol,p_name,p_mint,p_pair_address,
    p_entry_price,p_entry_price,p_entry_price,p_notional_usd/p_entry_price,p_notional_usd
  ) returning id into v_position_id;

  update public.strategy_runtime set daily_entries=daily_entries+1, updated_at=now() where strategy=p_strategy;
  insert into public.activity_log(category,action,actor,payload)
  values('trade','paper_position_opened','signal-engine',jsonb_build_object(
    'positionId',v_position_id,'signalId',p_signal_id,'strategy',p_strategy,'mint',p_mint,
    'symbol',p_symbol,'entryPrice',p_entry_price,'notionalUsd',p_notional_usd,'score',p_score
  ));
  return jsonb_build_object('created', true, 'reason', 'paper_position_opened', 'position_id', v_position_id);
exception when others then
  raise;
end;
$$;

create or replace function public.close_paper_position(p_position_id uuid, p_exit_price numeric, p_exit_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_position public.paper_positions%rowtype;
  v_pnl_pct numeric;
  v_pnl_usd numeric;
  v_losses integer;
begin
  if p_exit_price <= 0 then return jsonb_build_object('closed', false, 'reason', 'invalid_exit_price'); end if;
  select * into v_position from public.paper_positions where id=p_position_id for update;
  if not found or v_position.status <> 'open' then return jsonb_build_object('closed', false, 'reason', 'not_open'); end if;

  v_pnl_pct := ((p_exit_price-v_position.entry_price)/v_position.entry_price)*100;
  v_pnl_usd := v_position.notional_usd*v_pnl_pct/100;
  update public.paper_positions set
    status='closed',current_price=p_exit_price,highest_price=greatest(highest_price,p_exit_price),
    exit_price=p_exit_price,pnl_pct=v_pnl_pct,pnl_usd=v_pnl_usd,
    exit_reason=p_exit_reason,closed_at=now(),updated_at=now()
  where id=p_position_id;
  update public.signals set status='paper_closed',updated_at=now() where signal_id=v_position.signal_id;

  update public.strategy_runtime set
    consecutive_losses=case when v_pnl_usd < 0 then consecutive_losses+1 else 0 end,
    daily_pnl_usd=daily_pnl_usd+v_pnl_usd,
    last_outcome=case when v_pnl_usd < 0 then 'LOSS' else 'WIN' end,
    updated_at=now()
  where strategy=v_position.strategy
  returning consecutive_losses into v_losses;
  if v_losses >= 4 then
    update public.strategy_runtime set paused_until=now()+interval '45 minutes',updated_at=now()
    where strategy=v_position.strategy;
  end if;

  insert into public.activity_log(category,action,actor,payload)
  values('trade','paper_position_closed','position-monitor',jsonb_build_object(
    'positionId',p_position_id,'strategy',v_position.strategy,'mint',v_position.mint,
    'symbol',v_position.symbol,'exitPrice',p_exit_price,'pnlUsd',v_pnl_usd,
    'pnlPct',v_pnl_pct,'reason',p_exit_reason
  ));
  return jsonb_build_object('closed',true,'pnl_usd',v_pnl_usd,'pnl_pct',v_pnl_pct);
end;
$$;

-- Helper invoked once after the Vercel production URL and secrets exist.
-- It stores the URL and CRON secret in Supabase Vault and schedules both jobs.
