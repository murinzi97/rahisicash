-- =====================================================================
-- Rahisi Cash: migration 0004 (step 3: payments)
-- Run this ONCE in the Supabase SQL editor, after 0001, 0002 and 0003.
--
--  * transactions.request_id: a random id the app creates for each
--    "Create payment link" attempt. If the agent double-taps, or the phone
--    retries after a bad connection, the same request never creates a
--    second transaction or a second Pesapal order.
--  * app_config: a small key/value table only Edge Functions can touch.
--    It remembers the Pesapal IPN id so we register it once, not on
--    every payment.
-- =====================================================================

-- ---------- idempotency key for payment creation -------------------
alter table public.transactions
  add column if not exists request_id uuid;

create unique index if not exists transactions_agent_request_uidx
  on public.transactions (agent_id, request_id)
  where request_id is not null;

-- ---------- app_config (service role only) -------------------------
create table if not exists public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- RLS on with NO policies and NO grants: browsers can never read or write
-- it. The service role (Edge Functions) bypasses RLS.
alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
