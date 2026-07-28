create or replace function public.claim_telegram_update(p_update_id bigint, p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telegram_updates(update_id,payload)
  values(p_update_id,p_payload)
  on conflict (update_id) do nothing;

  update public.telegram_updates
  set processing_started_at=now(), payload=p_payload
  where update_id=p_update_id
    and processed_at is null
    and (processing_started_at is null or processing_started_at < now()-interval '2 minutes');
  return found;
end;
$$;

create or replace function public.claim_job(p_job_name text, p_run_id text, p_ttl_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  insert into public.job_leases(job_name, run_id, locked_until, updated_at)
  values (p_job_name, p_run_id, now() + make_interval(secs => greatest(30, p_ttl_seconds)), now())
  on conflict (job_name) do update
    set run_id = excluded.run_id,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.job_leases.locked_until < now();

  select exists(
    select 1 from public.job_leases where job_name = p_job_name and run_id = p_run_id
  ) into claimed;
  return claimed;
end;
$$;

create or replace function public.release_job(p_job_name text, p_run_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.job_leases where job_name = p_job_name and run_id = p_run_id;
  return found;
end;
$$;

drop function if exists public.create_signal_and_position(text,text,text,numeric,text,text,text,text,numeric,numeric,integer,integer);

