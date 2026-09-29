-- Worker de staging/validação. Não aprova nem publica a base IPM.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.ipm_import_runs
  add column if not exists worker_lease_token uuid,
  add column if not exists worker_lease_until timestamptz,
  add column if not exists worker_attempts integer not null default 0,
  add column if not exists worker_retry_after timestamptz,
  add column if not exists worker_last_error text;

create or replace function public.claim_next_ipm_import()
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  selected_id uuid;
  claim_token uuid := gen_random_uuid();
begin
  select id into selected_id
  from public.ipm_import_runs
  where status = 'validating'
    and stored_path is not null
    and (worker_lease_until is null or worker_lease_until < clock_timestamp())
    and (worker_retry_after is null or worker_retry_after <= clock_timestamp())
  order by created_at, id
  for update skip locked
  limit 1;

  if selected_id is null then
    return null;
  end if;

  update public.ipm_import_runs
  set worker_lease_token = claim_token,
      worker_lease_until = clock_timestamp() + interval '5 minutes',
      worker_attempts = worker_attempts + 1,
      worker_last_error = null
  where id = selected_id;

  return jsonb_build_object('run_id', selected_id, 'lease_token', claim_token);
end;
$$;

create or replace function public.finish_ipm_import_worker(
  p_run_id uuid,
  p_lease_token uuid,
  p_error text default null
)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  current_attempts integer;
begin
  select worker_attempts into current_attempts
  from public.ipm_import_runs
  where id = p_run_id and worker_lease_token = p_lease_token
  for update;
  if not found then return false; end if;

  update public.ipm_import_runs
  set worker_lease_token = null,
      worker_lease_until = null,
      worker_last_error = left(p_error, 500),
      worker_retry_after = case
        when p_error is null then null
        else clock_timestamp() + (least(60, power(2, least(current_attempts, 6))::integer) || ' minutes')::interval
      end,
      status = case
        when p_error is not null and current_attempts >= 5 and status = 'validating' then 'failed'
        else status
      end,
      review_notes = case
        when p_error is not null and current_attempts >= 5 and status = 'validating'
        then 'O processamento automático falhou após cinco tentativas. A base oficial não foi alterada.'
        else review_notes
      end
  where id = p_run_id and worker_lease_token = p_lease_token;
  return true;
end;
$$;

revoke all on function public.claim_next_ipm_import() from public, anon, authenticated;
revoke all on function public.finish_ipm_import_worker(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_next_ipm_import() to service_role;
grant execute on function public.finish_ipm_import_worker(uuid, uuid, text) to service_role;

-- Configure no Vault: seplanbi_worker_url, seplanbi_worker_token,
-- seplanbi_vercel_bypass_token. Sem todos os três, nenhum HTTP é enviado.
create or replace function public.dispatch_seplanbi_ipm_worker()
returns bigint
language plpgsql security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  worker_url text;
  worker_token text;
  bypass_token text;
begin
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'seplanbi_worker_url';
  select decrypted_secret into worker_token from vault.decrypted_secrets where name = 'seplanbi_worker_token';
  select decrypted_secret into bypass_token from vault.decrypted_secrets where name = 'seplanbi_vercel_bypass_token';
  if worker_url is null or worker_token is null or bypass_token is null then
    return null;
  end if;
  if left(worker_url, 8) <> 'https://' then
    raise exception 'Worker URL must use HTTPS';
  end if;
  return net.http_get(
    url := worker_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || worker_token,
      'x-vercel-protection-bypass', bypass_token
    ),
    timeout_milliseconds := 5000
  );
end;
$$;
revoke all on function public.dispatch_seplanbi_ipm_worker() from public, anon, authenticated;
grant execute on function public.dispatch_seplanbi_ipm_worker() to service_role;

select cron.schedule(
  'seplanbi-ipm-worker',
  '* * * * *',
  $$select public.dispatch_seplanbi_ipm_worker()$$
);
