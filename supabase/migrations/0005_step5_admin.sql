-- =====================================================================
-- Rahisi Cash: migration 0005 (step 5: admin portal)
-- Run this ONCE in the Supabase SQL editor, after 0001 to 0004.
--
--  * set_pesapal_fee: an admin enters the Pesapal processing fee of one
--    paid transaction (Pesapal's status reply does not include it).
--    Service role only (called by the admin-money Edge Function).
--  * admin_balance_summary: the figures on the Balance tab. Pesapal fees
--    and net revenue are counted since the last "Reset my balance", so
--    they always match the balance shown above them.
--  * two small indexes for the admin lists.
-- Nothing here changes existing money data.
-- =====================================================================

create or replace function public.set_pesapal_fee(p_actor uuid, p_tx uuid, p_fee numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t     public.transactions;
  v_old numeric;
  v_new numeric := case when p_fee is null then null else round(p_fee, 2) end;
begin
  perform public.assert_admin(p_actor);
  if v_new is not null and v_new < 0 then raise exception 'invalid_fee'; end if;

  select * into t from public.transactions where id = p_tx for update;
  if not found then raise exception 'transaction_not_found'; end if;
  if t.status <> 'paid' then raise exception 'not_paid'; end if;
  if v_new is not null and v_new > t.total_paid then raise exception 'invalid_fee'; end if;

  select pesapal_fee into v_old from public.payment_details where transaction_id = p_tx;

  insert into public.payment_details (transaction_id, pesapal_fee)
  values (p_tx, v_new)
  on conflict (transaction_id) do update
    set pesapal_fee = excluded.pesapal_fee, updated_at = now();

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'pesapal_fee_set', 'transaction', p_tx::text,
          jsonb_build_object('from', v_old, 'to', v_new));
end;
$$;

create or replace function public.admin_balance_summary()
returns table (
  balance           bigint,       -- system fee balance (ledger)
  since             timestamptz,  -- last reset, empty if never reset
  system_fees       bigint,       -- system fees of paid transactions since then
  pesapal_fees      numeric,      -- Pesapal fees entered for those transactions
  unknown_fee_count bigint,       -- how many of them have no Pesapal fee yet
  net_revenue       numeric       -- system fees - Pesapal fees; empty while any fee is unknown
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select max(l.created_at) into v_since from public.ledger_entries l where l.type = 'reset';

  return query
    select
      (select coalesce(sum(l.amount), 0)::bigint from public.ledger_entries l where l.account = 'system'),
      v_since,
      coalesce(sum(t.system_fee), 0)::bigint,
      coalesce(sum(d.pesapal_fee), 0)::numeric,
      count(*) filter (where d.pesapal_fee is null),
      case when count(*) filter (where d.pesapal_fee is null) = 0
           then coalesce(sum(t.system_fee), 0) - coalesce(sum(d.pesapal_fee), 0) end
    from public.transactions t
    left join public.payment_details d on d.transaction_id = t.id
    where t.status = 'paid' and (v_since is null or t.paid_at > v_since);
end;
$$;

create index if not exists payouts_created_at_idx on public.payouts (created_at desc);
create index if not exists ledger_reset_idx on public.ledger_entries (created_at) where type = 'reset';

-- who may run what
revoke execute on function public.set_pesapal_fee(uuid, uuid, numeric) from public, anon, authenticated;
grant  execute on function public.set_pesapal_fee(uuid, uuid, numeric) to service_role;

revoke execute on function public.admin_balance_summary() from public, anon;
grant  execute on function public.admin_balance_summary() to authenticated;
