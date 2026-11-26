-- =====================================================================
-- Rahisi Cash: migration 0003
-- Client (customer) phone numbers may now be from ANY country.
-- Stored in international E.164 form: "+", then 7 to 15 digits, no leading 0.
-- (Agent phones stay limited to Rwanda or DR Congo; see migration 0002.)
-- Run this ONCE in the Supabase SQL editor.
-- =====================================================================

-- Drop the old Rwanda-only rule on transactions.client_phone, whatever it is named.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%client_phone%'
  loop
    execute format('alter table public.transactions drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.transactions
  add constraint transactions_client_phone_check
  check (client_phone ~ '^\+[1-9][0-9]{6,14}$');
