create or replace function public.configure_moonshot_cron(p_base_url text, p_cron_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, cron
as $$
declare
  v_url_id uuid;
  v_secret_id uuid;
begin
  if p_base_url !~ '^https://[^/]+/?$' then raise exception 'base URL must be an HTTPS origin'; end if;
  if length(p_cron_secret) < 24 then raise exception 'cron secret must contain at least 24 characters'; end if;

  select id into v_url_id from vault.secrets where name='moonshot_base_url' limit 1;
  if v_url_id is null then
    perform vault.create_secret(rtrim(p_base_url,'/'),'moonshot_base_url','MoonShotForge Vercel production origin');
  else
    perform vault.update_secret(v_url_id,rtrim(p_base_url,'/'),'moonshot_base_url','MoonShotForge Vercel production origin');
  end if;

  select id into v_secret_id from vault.secrets where name='moonshot_cron_secret' limit 1;
  if v_secret_id is null then
    perform vault.create_secret(p_cron_secret,'moonshot_cron_secret','Bearer token for MoonShotForge scheduled jobs');
  else
    perform vault.update_secret(v_secret_id,p_cron_secret,'moonshot_cron_secret','Bearer token for MoonShotForge scheduled jobs');
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname in ('moonshot-candidate-scan','moonshot-position-monitor');

  perform cron.schedule(
    'moonshot-candidate-scan',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='moonshot_base_url') || '/api/jobs/scan',
        headers := jsonb_build_object(
          'content-type','application/json',
          'authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='moonshot_cron_secret')
        ),
        body := jsonb_build_object('source','supabase-cron','at',now()),
        timeout_milliseconds := 120000
      );
    $job$
  );

  perform cron.schedule(
    'moonshot-position-monitor',
    '* * * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name='moonshot_base_url') || '/api/jobs/positions',
        headers := jsonb_build_object(
          'content-type','application/json',
          'authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='moonshot_cron_secret')
        ),
        body := jsonb_build_object('source','supabase-cron','at',now()),
        timeout_milliseconds := 120000
      );
    $job$
  );

  return jsonb_build_object('configured',true,'base_url',rtrim(p_base_url,'/'));
end;
$$;

-- Lock down data. Only the service-role key should access these tables through the API.
do $$
declare t text;
begin
  foreach t in array array[
    'system_settings','bot_users','telegram_updates','activity_log','boss_cursors',
    'candidates','strategy_scores','strategy_runtime','strategy_config','signals','paper_positions',
    'job_leases','job_runs'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
  end loop;
end $$;

revoke all on function public.claim_telegram_update(bigint,jsonb) from public, anon, authenticated;
revoke all on function public.claim_job(text,text,integer) from public, anon, authenticated;
revoke all on function public.release_job(text,text) from public, anon, authenticated;
revoke all on function public.create_signal_and_position(text,text,text,numeric,text,text,text,text,numeric,numeric,integer,integer,integer) from public, anon, authenticated;
revoke all on function public.close_paper_position(uuid,numeric,text) from public, anon, authenticated;
revoke all on function public.configure_moonshot_cron(text,text) from public, anon, authenticated;
grant execute on function public.claim_telegram_update(bigint,jsonb) to service_role;
grant execute on function public.claim_job(text,text,integer) to service_role;
grant execute on function public.release_job(text,text) to service_role;
grant execute on function public.create_signal_and_position(text,text,text,numeric,text,text,text,text,numeric,numeric,integer,integer,integer) to service_role;
grant execute on function public.close_paper_position(uuid,numeric,text) to service_role;
grant execute on function public.configure_moonshot_cron(text,text) to service_role;

-- Realtime dashboard support. Safe because RLS remains enabled and no client policies exist.
do $$
begin
  alter publication supabase_realtime add table public.signals;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.paper_positions;
exception when duplicate_object then null;
end $$;
