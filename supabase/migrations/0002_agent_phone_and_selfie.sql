-- =====================================================================
-- Rahisi Cash: migration 0002
--  * Agent phones may be Rwandan (+250) or Congolese DRC (+243)
--  * Agents choose National ID or Passport
--  * A selfie is required at registration and becomes the profile picture
-- Run this ONCE in the Supabase SQL editor, after 0001.
-- Client (customer) phones on transactions stay Rwanda-only for now.
-- =====================================================================

-- ---------- agent phone: Rwanda (+250 7[2389]xxxxxxx) or DRC (+243 [89]xxxxxxxx)
alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check
  check (phone is null
         or phone ~ '^\+(2507[2389][0-9]{7}|243[89][0-9]{8})$');

-- ---------- new profile columns ------------------------------------
alter table public.profiles
  add column if not exists id_type     text check (id_type in ('national_id', 'passport')),
  add column if not exists avatar_path text;   -- storage path of the selfie in the private 'kyc' bucket

-- ---------- kyc documents now have a kind --------------------------
alter table public.kyc_documents
  add column if not exists kind text not null default 'id_document'
    check (kind in ('id_document', 'selfie'));

-- one ID document and one selfie per agent
create unique index if not exists kyc_one_per_kind
  on public.kyc_documents (agent_id, kind);

-- ---------- helper: is the caller a PENDING agent? -----------------
-- Agents can add or replace verification files only while pending. After
-- approval nobody but an admin can change them, so the profile picture
-- cannot be swapped once the agent has been verified.
create or replace function public.is_pending_agent()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'agent' and status = 'pending'
  );
$$;
revoke execute on function public.is_pending_agent() from public, anon;
grant execute on function public.is_pending_agent() to authenticated;

drop policy if exists kyc_insert_own on public.kyc_documents;
create policy kyc_insert_own on public.kyc_documents
  for insert to authenticated
  with check (agent_id = auth.uid() and public.is_pending_agent());

drop policy if exists kyc_storage_insert_own on storage.objects;
create policy kyc_storage_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kyc'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_pending_agent());

-- ---------- the selfie becomes the profile picture -----------------
create or replace function public.set_avatar_from_selfie()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'selfie' then
    update public.profiles set avatar_path = new.storage_path where id = new.agent_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.set_avatar_from_selfie() from public, anon, authenticated;

drop trigger if exists kyc_selfie_sets_avatar on public.kyc_documents;
create trigger kyc_selfie_sets_avatar
  after insert on public.kyc_documents
  for each row execute function public.set_avatar_from_selfie();

-- ---------- sign-up trigger: new phone rule and id_type ------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := nullif(new.raw_user_meta_data ->> 'phone', '');
  v_lang  text := coalesce(new.raw_user_meta_data ->> 'language', 'en');
  v_idt   text := coalesce(new.raw_user_meta_data ->> 'id_type', 'national_id');
begin
  if v_phone is not null and v_phone !~ '^\+(2507[2389][0-9]{7}|243[89][0-9]{8})$' then
    raise exception 'invalid_phone';
  end if;
  if v_lang not in ('en', 'fr') then v_lang := 'en'; end if;
  if v_idt not in ('national_id', 'passport') then v_idt := 'national_id'; end if;

  insert into public.profiles (id, role, full_name, phone, id_number, id_type, status, language)
  values (
    new.id, 'agent',
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Unnamed'), 120),
    v_phone,
    left(nullif(trim(new.raw_user_meta_data ->> 'id_number'), ''), 40),
    v_idt,
    'pending',
    v_lang
  );
  return new;
end;
$$;
