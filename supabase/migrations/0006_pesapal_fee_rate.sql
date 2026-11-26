-- =====================================================================
-- Rahisi Cash: migration 0006 (Pesapal fee = 3.5% of what the client paid)
-- Run ONCE in the Supabase SQL editor, after 0005.
--
-- When a transaction becomes "paid", its pesapal_fee is filled in
-- automatically: total_paid x 3.5%, rounded to the nearest whole RWF.
--  * The amount is stored on the transaction record, so a later change of
--    the rate never alters past records.
--  * If Pesapal ever returns the real fee, confirm_payment overwrites the
--    estimate with it. An admin can also correct one fee by hand
--    (All Transactions > Pesapal fee).
--  * Existing paid transactions without a fee are filled in once, below.
-- To change the rate later: edit v_rate here (and PESAPAL_FEE_PERCENT in
-- src/lib/pesapal.ts; a test checks that they match) and run it again.
-- =====================================================================

create or replace function public.apply_pesapal_fee()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_rate constant numeric := 3.5;   -- percent of total_paid
begin
  update public.payment_details
     set pesapal_fee = round(new.total_paid * v_rate / 100),
         updated_at  = now()
   where transaction_id = new.id and pesapal_fee is null;
  return new;
end;
$$;

drop trigger if exists transactions_apply_pesapal_fee on public.transactions;
create trigger transactions_apply_pesapal_fee
  after update of status on public.transactions
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.apply_pesapal_fee();

revoke execute on function public.apply_pesapal_fee() from public, anon, authenticated;

-- one-time fill for payments that were already paid
update public.payment_details d
   set pesapal_fee = round(t.total_paid * 3.5 / 100), updated_at = now()
  from public.transactions t
 where t.id = d.transaction_id and t.status = 'paid' and d.pesapal_fee is null;
