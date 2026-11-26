-- =====================================================================
-- Rahisi Cash: migration 0007 (agent payout option)
-- Run this ONCE in the Supabase SQL editor, after 0001 to 0006.
--
--  * payout_methods: where an agent wants to be paid (a bank account or a
--    mobile money number). One row per agent.
--  * Agents can read and write ONLY their own row. Admins can read all rows
--    (to see where to send a payout) but cannot change them.
--  * Every change is written to the audit log (method, provider and the
--    last 4 characters only, never the full number).
--  * "Delete my account" now also erases the payout option.
-- Nothing here changes existing money data.
-- =====================================================================

create table public.payout_methods (
  agent_id       uuid primary key references public.profiles (id),
  method         text not null check (method in ('bank', 'mobile_money')),
  -- bank name, or mobile money provider (MTN MoMo, Airtel Money, ...)
  provider       text not null check (char_length(provider) between 2 and 60),
  -- the name the account or mobile money number is registered in
  account_name   text not null check (char_length(account_name) between 2 and 120),
  -- bank: the account number; mobile money: the phone number in +country format
  account_number text not null,
  updated_at     timestamptz not null default now(),
  check (method <> 'mobile_money' or account_number ~ '^\+[1-9][0-9]{6,14}$'),
  check (method <> 'bank' or account_number ~ '^[0-9A-Za-z ./-]{4,34}$')
);

alter table public.payout_methods enable row level security;

create policy payout_methods_select on public.payout_methods
  for select to authenticated
  using (agent_id = auth.uid() or public.is_admin());

-- agents only: the row must be theirs and they must be an agent
create policy payout_methods_insert_own on public.payout_methods
  for insert to authenticated
  with check (agent_id = auth.uid()
              and exists (select 1 from public.profiles p
                          where p.id = auth.uid() and p.role = 'agent' and p.anonymized_at is null));
create policy payout_methods_update_own on public.payout_methods
  for update to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

grant select on public.payout_methods to authenticated;
grant insert (agent_id, method, provider, account_name, account_number) on public.payout_methods to authenticated;
grant update (method, provider, account_name, account_number) on public.payout_methods to authenticated;

-- keep updated_at honest and write the audit entry, whatever the browser sends
create or replace function public.payout_method_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'payout_method_changed', 'payout_method', new.agent_id::text,
          jsonb_build_object('method', new.method, 'provider', new.provider,
                             'last4', right(new.account_number, 4)));
  return new;
end;
$$;
revoke execute on function public.payout_method_changed() from public, anon, authenticated;

create trigger payout_method_write
  before insert or update on public.payout_methods
  for each row execute function public.payout_method_changed();

-- "Delete my account": same as before (migration 0001), plus the payout option.
create or replace function public.anonymize_agent(p_agent uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_balance bigint;
begin
  select coalesce(sum(amount), 0) into v_balance
  from public.ledger_entries where agent_id = p_agent and account = 'agent';
  if v_balance <> 0 then raise exception 'balance_not_zero'; end if;
  if exists (select 1 from public.transactions where agent_id = p_agent and status = 'pending') then
    raise exception 'pending_payments';
  end if;

  update public.profiles
     set full_name = 'Deleted agent', phone = null, id_number = null,
         status = 'suspended', anonymized_at = now()
   where id = p_agent and role = 'agent';
  delete from public.kyc_documents where agent_id = p_agent;
  delete from public.payout_methods where agent_id = p_agent;

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (p_agent, 'account_deleted', 'profile', p_agent::text);
end;
$$;
