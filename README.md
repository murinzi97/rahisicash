# Rahisi Cash web app: steps 1 to 4

Single login that routes by role, Light / Night / Auto theme, English / French,
agent registration with ID upload, and the admin Agents tab.

## Run it on your computer
1. Install Node.js (nodejs.org, the LTS version).
2. In this folder run:  npm install
3. Copy `.env.example` to `.env` and fill in the two values from
   Supabase -> Project Settings -> API (project URL and the PUBLISHABLE / anon key).
   NEVER use the service role / secret key here.
4. Run:  npm run dev   and open the address it prints.
5. Optional: npm test   (routing and money-format tests)

## Try the three routes (use the test users you made in Supabase)
- Agent with status `pending`   -> "Pending approval" screen
- Same agent after you run in the SQL editor
  `update public.profiles set status = 'active' where id = '<agent id>';`
  -> press "Check again" -> agent home
- Admin (role admin, status active) -> admin portal
- Set status to `suspended` or `rejected` -> blocked screen with Log out

## Deploying later
It is a single-page app. On Netlify or Vercel add a rewrite so every path
serves index.html, otherwise reloading /agent shows "not found".

## Supabase settings to check
- Authentication -> Providers -> Email: enabled.
- Authentication -> Sign In / Providers: turn "Confirm email" OFF for now
  (registration in step 2 uploads a document straight after sign-up).

## Step 2: deploy the approval function (needed for Approve / Reject / Suspend)
The admin buttons call an Edge Function so the secret key never reaches the browser.
In Supabase: Edge Functions -> Deploy a new function -> Via Editor.
  1. Name it exactly:  admin-set-agent-status
  2. Paste the whole of supabase/functions/admin-set-agent-status/index.ts
  3. Deploy. Leave "Verify JWT" ON.
Supabase adds the three keys the function needs by itself; you set nothing.

## Test step 2
1. Log out, press "Register as an agent", fill the form with a test ID photo.
2. You should land on "Pending approval".
3. Log in as your admin, open Agents, press "View KYC" (you should see the photo),
   then "Approve". The agent's pending screen moves to the agent home.

## Step 2 update: Rwanda or DR Congo phones, ID/passport, selfie (RUN THIS FIRST)
1. In the Supabase SQL editor run supabase/migrations/0002_agent_phone_and_selfie.sql (once).
2. Registration is now two steps: details + ID/passport photo, then a live selfie.
   The selfie becomes the agent's profile picture (agent home, pending screen,
   admin Agents list and KYC viewer).
3. The camera only works on https:// pages or http://localhost.
4. Agents can only add or change these files while their status is "pending".
   After approval only an admin can change them.

## Client phones from any country (RUN THIS TOO)
Run supabase/migrations/0003_client_phone_worldwide.sql once in the SQL editor.
Agents are still limited to Rwanda or DR Congo numbers. Customers can be anywhere:
the agent types the number with its country code (e.g. +254 712 345 678);
a number without a country code is read as a Rwandan or Congolese local number.
The app checks the international format (E.164) but cannot confirm that a number
really exists in its country. For stricter per-country checks, add the
libphonenumber-js package when the withdrawal form is built in step 3.

---

# Step 3: new withdrawal, server-side fees, Pesapal payment (sandbox)

## What is new
- **New withdrawal** screen (agent home -> "New withdrawal"). The fee preview comes from the
  server; the app never calculates a fee. Creating the link makes the transaction and a
  Pesapal order for `total_paid`, then shows the payment link and a live status.
- **create-payment** Edge Function: checks the caller is an ACTIVE agent, validates everything,
  calculates fees from the newest `fee_settings` row, stores every fee field on the
  transaction, rate-limits (10 new payments per agent per 10 minutes) and is idempotent
  (a double tap or retry never makes a second payment).
- **pesapal-ipn** Edge Function: Pesapal's notification. It never trusts the notification:
  it asks Pesapal for the real status, checks amount and currency, and calls the database
  function `confirm_payment`, which books the ledger entries exactly once.
- **/pay/done**: a public page the client sees after paying (in the language chosen for the
  withdrawal). It makes no claim about the payment; the agent's screen shows the real result.

## Do these in order
1. **SQL:** run `supabase/migrations/0004_step3_payments.sql` once in the SQL editor.
2. **Pesapal sandbox keys:** from your Pesapal developer account (sandbox), copy the consumer key
   and consumer secret.
3. **Secrets:** Supabase -> Edge Functions -> Secrets -> add
   - `PESAPAL_CONSUMER_KEY`
   - `PESAPAL_CONSUMER_SECRET`
   - `APP_URL`  the address of this app, with no trailing slash
     (testing on your computer: `http://localhost:5173`; later your real https address)
   Do NOT add `PESAPAL_BASE_URL` while testing: the default is the Pesapal sandbox.
4. **Deploy two functions** (Edge Functions -> Deploy a new function -> Via Editor), pasting the
   whole file each time:
   | Name | File | Verify JWT |
   |---|---|---|
   | `create-payment` | `supabase/functions/create-payment/index.ts` | **ON** |
   | `pesapal-ipn` | `supabase/functions/pesapal-ipn/index.ts` | **OFF** |
   Pesapal is not a logged-in user, so the IPN function must have Verify JWT switched off.
   With the Supabase CLI: `supabase functions deploy pesapal-ipn --no-verify-jwt`.
5. `npm install`, then `npm test` (35 tests, including the fee examples) and `npm run dev`.

## Test it
1. Log in as an ACTIVE agent -> New withdrawal.
2. Amount 10,000 with the default 2% + 1%. The breakdown must read:
   cash 10,000 / transaction fee 300 / client charged 10,300 / you will be owed 10,200.
3. Fill client name and phone (with country code for non-Rwandan numbers), press
   "Create payment link". You get a link and the status "Waiting".
4. Press "Open payment page" and pay with a Pesapal sandbox test card or mobile-money number
   (listed in Pesapal's developer documentation). The agent screen turns to "Payment received"
   by itself.
5. Check the books in the SQL editor:
   ```sql
   select type, account, amount, transaction_id from public.ledger_entries order by id desc limit 5;
   -- expect: agent_owed 10200 (agent) and system_revenue 100 (system)
   select id, status, total_paid, paid_at from public.transactions order by created_at desc limit 3;
   ```
6. Idempotency: in Pesapal's sandbox, or by opening the pesapal-ipn address again, repeat the
   notification. The ledger must not get a second pair of rows.

## If something does not work
Open Supabase -> Edge Functions -> (the function) -> Logs.
- Agent sees "The payment service did not respond": look for `pesapal order failed: <code>`.
  `pesapal_http_401` or `pesapal_error_...` on the token step usually means wrong keys, or sandbox
  keys used against the live address (or the other way round).
- Status stays "Waiting" after paying: the IPN did not arrive. Check that `pesapal-ipn` has
  Verify JWT OFF and look at its logs for `pesapal status fields: ...`.
- `server_misconfigured`: `APP_URL` is missing, or there is no row in `fee_settings`.

## Things you should know
- **Minimum withdrawal is RWF 1,000.** It is my assumption, not from your brief. Change `MIN_AMOUNT`
  in `create-payment/index.ts` and in `src/lib/withdrawal.ts` (keep both the same).
- **Pesapal's fee is left empty.** Pesapal's status reply does not include its processing fee, so
  `payment_details.pesapal_fee` stays empty and "Net revenue" will show as unknown until we decide how to
  fill it (step 5; for example by entering it from Pesapal's statements).
- **The payment link is Pesapal's own address.** The short branded link in the mockup
  (pay.rahisicash.rw/p/...) needs a small redirect page; we can add it when you have the domain.
- **The shared code is copied, not imported,** so each function is one file you can paste into the
  Supabase editor. `npm test` fails if a copy drifts from `supabase/functions/_shared/` or from
  `src/lib/phone.ts`.
- **Going live later:** set `PESAPAL_BASE_URL=https://pay.pesapal.com/v3`, use live keys, and set
  `APP_URL` to your real address. The IPN registers itself again automatically.
- The client's phone check is the existing one (strict for Rwanda and DR Congo, standard international
  format for other countries). I did not add `libphonenumber-js`: I could not install and test it
  here, and the existing rules already cover the app's own countries.

---

# Step 4: agent home, waiting page, report, profile

No new SQL migration. Everything uses the tables and views from 0001 to 0004.

## Deploy one new function (needed for admin "Delete" on the Agents tab)
Supabase -> Edge Functions -> Deploy a new function -> Via Editor.
  1. Name it exactly:  admin-delete-agent
  2. Paste supabase/functions/admin-delete-agent/index.ts
  3. Deploy. Leave "Verify JWT" ON.
(If you already deployed `delete-account` from the earlier step 4 zip, delete it in the dashboard.
Agents cannot delete their own accounts any more.)

## What is new
- **New withdrawal** screen (agent home -> "New withdrawal"). The fee preview comes from the
  server; the app never calculates a fee. Creating the link makes the transaction and a
  Pesapal order for `total_paid`, then shows the payment link and a live status.
- **create-payment** Edge Function: checks the caller is an ACTIVE agent, validates everything,
  calculates fees from the newest `fee_settings` row, stores every fee field on the
  transaction, rate-limits (10 new payments per agent per 10 minutes) and is idempotent
  (a double tap or retry never makes a second payment).
- **pesapal-ipn** Edge Function: Pesapal's notification. It never trusts the notification:
  it asks Pesapal for the real status, checks amount and currency, and calls the database
  function `confirm_payment`, which books the ledger entries exactly once.
- **/pay/done**: a public page the client sees after paying (in the language chosen for the
  withdrawal). It makes no claim about the payment; the agent's screen shows the real result.

## Do these in order
1. **SQL:** run `supabase/migrations/0004_step3_payments.sql` once in the SQL editor.
2. **Pesapal sandbox keys:** from your Pesapal developer account (sandbox), copy the consumer key
   and consumer secret.
3. **Secrets:** Supabase -> Edge Functions -> Secrets -> add
   - `PESAPAL_CONSUMER_KEY`
   - `PESAPAL_CONSUMER_SECRET`
   - `APP_URL`  the address of this app, with no trailing slash
     (testing on your computer: `http://localhost:5173`; later your real https address)
   Do NOT add `PESAPAL_BASE_URL` while testing: the default is the Pesapal sandbox.
4. **Deploy two functions** (Edge Functions -> Deploy a new function -> Via Editor), pasting the
   whole file each time:
   | Name | File | Verify JWT |
   |---|---|---|
   | `create-payment` | `supabase/functions/create-payment/index.ts` | **ON** |
   | `pesapal-ipn` | `supabase/functions/pesapal-ipn/index.ts` | **OFF** |
   Pesapal is not a logged-in user, so the IPN function must have Verify JWT switched off.
   With the Supabase CLI: `supabase functions deploy pesapal-ipn --no-verify-jwt`.
5. `npm install`, then `npm test` (35 tests, including the fee examples) and `npm run dev`.

## Test it
1. Log in as an ACTIVE agent -> New withdrawal.
2. Amount 10,000 with the default 2% + 1%. The breakdown must read:
   cash 10,000 / transaction fee 300 / client charged 10,300 / you will be owed 10,200.
3. Fill client name and phone (with country code for non-Rwandan numbers), press
   "Create payment link". You get a link and the status "Waiting".
4. Press "Open payment page" and pay with a Pesapal sandbox test card or mobile-money number
   (listed in Pesapal's developer documentation). The agent screen turns to "Payment received"
   by itself.
5. Check the books in the SQL editor:
   ```sql
   select type, account, amount, transaction_id from public.ledger_entries order by id desc limit 5;
   -- expect: agent_owed 10200 (agent) and system_revenue 100 (system)
   select id, status, total_paid, paid_at from public.transactions order by created_at desc limit 3;
   ```
6. Idempotency: in Pesapal's sandbox, or by opening the pesapal-ipn address again, repeat the
   notification. The ledger must not get a second pair of rows.

## If something does not work
Open Supabase -> Edge Functions -> (the function) -> Logs.
- Agent sees "The payment service did not respond": look for `pesapal order failed: <code>`.
  `pesapal_http_401` or `pesapal_error_...` on the token step usually means wrong keys, or sandbox
  keys used against the live address (or the other way round).
- Status stays "Waiting" after paying: the IPN did not arrive. Check that `pesapal-ipn` has
  Verify JWT OFF and look at its logs for `pesapal status fields: ...`.
- `server_misconfigured`: `APP_URL` is missing, or there is no row in `fee_settings`.

## Things you should know
- **Minimum withdrawal is RWF 1,000.** It is my assumption, not from your brief. Change `MIN_AMOUNT`
  in `create-payment/index.ts` and in `src/lib/withdrawal.ts` (keep both the same).
- **Pesapal's fee is left empty.** Pesapal's status reply does not include its processing fee, so
  `payment_details.pesapal_fee` stays empty and "Net revenue" will show as unknown until we decide how to
  fill it (step 5; for example by entering it from Pesapal's statements).
- **The payment link is Pesapal's own address.** The short branded link in the mockup
  (pay.rahisicash.rw/p/...) needs a small redirect page; we can add it when you have the domain.
- **The shared code is copied, not imported,** so each function is one file you can paste into the
  Supabase editor. `npm test` fails if a copy drifts from `supabase/functions/_shared/` or from
  `src/lib/phone.ts`.
- **Going live later:** set `PESAPAL_BASE_URL=https://pay.pesapal.com/v3`, use live keys, and set
  `APP_URL` to your real address. The IPN registers itself again automatically.
- The client's phone check is the existing one (strict for Rwanda and DR Congo, standard international
  format for other countries). I did not add `libphonenumber-js`: I could not install and test it
  here, and the existing rules already cover the app's own countries.

---

# Step 4: agent home, waiting page, report, profile

No new SQL migration. Everything uses the tables and views from 0001 to 0004.

## Deploy one new function (needed only for "Delete my account")
Supabase -> Edge Functions -> Deploy a new function -> Via Editor.
  1. Name it exactly:  delete-account
  2. Paste supabase/functions/delete-account/index.ts
  3. Deploy. Leave "Verify JWT" ON.

## What is new
- **Agent home** (`/agent`): balance card from the `agent_summary` view (the ledger),
  "Pending orders" (tap one to reopen its waiting page), Online / Offline pill.
  It refreshes by itself when a payment lands (Realtime) and when you return to the tab.
  The footer has Profile & settings (language, Appearance), Log out and the EN | FR switch.
- **Waiting page** (`/agent/pay/:id`): loads the transaction from the database, live status
  (Realtime plus a 6-second backup check), the payment link, **Share on WhatsApp**
  (wa.me, message in the CLIENT's language), **Send by email** (only if the client gave an
  email), **Copy link**. When paid: green success card, the cash reminder, "Added to your
  balance" and the "Cash handed over" button.
- **My report** (`/agent/report`): date range (Kigali days, default = this month so far) and
  All / Paid / Unpaid / Voided. "Unpaid" = waiting, failed or expired. Voided rows are muted.
  Shows the latest 500 rows in the range.
- **Profile** (`/agent/profile`): details, language (saved on the device and on the account),
  Appearance, Log out. Agents cannot delete their own account; only an admin can.

## Test checklist
1. Home as an active agent: balance shows `RWF 0` and "0 transactions in balance" at first.
2. New withdrawal -> you land on the waiting page. Reload it: it still works (it reads the database).
3. Tap "Share on WhatsApp": the message is in the language chosen for the client (try Francais).
4. Complete a sandbox payment: the page turns green by itself. Press "Cash handed over":
   home now shows the balance (amount + commission) and "1 transaction in balance".
5. My report: filters work; set the dates to a day with nothing -> empty message.
6. Switch EN / FR in Profile; everything on the agent screens changes.
7. Admin -> Agents -> Delete (confirmation dialog): refused while the agent is owed money or has a
   payment waiting (message shown). Otherwise the agent becomes "Deleted agent", loses their login
   and files, and an `agent_deleted_by_admin` entry appears in the audit log.

## Decisions to know about
- **"Send by email" opens the agent's own mail app** (mailto:) with the message filled in.
  The app sends no emails itself, so there is no email provider or secret to set up.
- **"Cash handed over" does not write anything to the database.** The schema has no field for
  it, and agents cannot write to `transactions`. It simply closes the screen. If you want a
  recorded confirmation (and to show who has not confirmed), that needs a small migration
  plus an Edge Function; say so and I will add it.

## Step 5: admin portal (payouts, revenue, fee settings, CSV)

**Deploy, in this order**

1. SQL editor: run `supabase/migrations/0005_step5_admin.sql` (adds `set_pesapal_fee`, `admin_balance_summary`, two indexes; no existing data changes).
2. Edge Functions: create `admin-money` and paste `supabase/functions/admin-money/index.ts`. Leave **Verify JWT on**. It needs no new secrets.
3. Run the app (`npm run dev`) and log in as the admin. `npm test` should pass.

**What each tab does**

| Tab | Source | Notes |
|---|---|---|
| All Transactions / Orders | `transactions` (+ agent name, Pesapal fee) | Search, date range, agent, status. Void with a required reason. Orders = not yet paid (waiting, failed, expired). Phones are masked. |
| Daily Payout | `admin_payout_preview(date)` | Everything owed up to and including the chosen day. "Review payout" shows the figures; Confirm sends the total you saw, and if it changed nothing is paid. |
| Agent Balances | `agent_summary` | Agents with no activity are hidden. |
| Payout History | `payouts` | |
| System Revenue | `daily_revenue` | By day or month. A dash means a Pesapal fee is not entered yet. |
| Balance | `admin_balance_summary()` | Pesapal fees and net revenue are counted since the last reset, so they match the balance. Reset needs the word RESET. |
| Fee Settings | `fee_settings` (newest row) | Live preview uses `src/lib/fees.ts`, an exact copy of the server code (a test checks they match). Allowed range 0 to 20 % per fee, 2 decimals. |

All writes go through the `admin-money` function (actions: `void_transaction`, `create_payout`, `reset_balance`, `set_fees`, `set_pesapal_fee`). It checks the caller is an active admin, validates the input, then calls the database function that does the work and writes the audit log.

**Pesapal fee.** Pesapal's status reply does not include its fee, so it is entered by hand: All Transactions > a paid row > "Pesapal fee". Net revenue shows once every payment in the period has one.

**CSV.** Plain numbers, ISO 8601 timestamps (UTC), UTF-8 with a byte-order mark. Column headers follow the app language. French uses `;` as the separator and English `,`, which is what Excel expects in each. Client phones are exported masked. Transaction exports follow the filters on screen (up to 20,000 rows).

**Known limits**

- Voiding an unpaid order does not cancel the Pesapal link. If the client pays it anyway, the payment is not booked (it is logged) and you must refund it with Pesapal.
- A paid transaction that was already paid out cannot be voided (`already_paid_out`); that needs a manual decision.
- Optional minimum fee per fee type is not built (it would touch `create-payment` and every stored fee). Say if you want it.

## Step 6: Light / Night theme polish

- **No flash:** `index.html` sets the theme before the first paint, so a phone in Night mode never flashes light. The rule is the same as `resolveTheme` in `src/lib/theme.ts` (unit-tested).
- **Auto** follows the phone or computer and switches live when the system does. The choice is saved on the device (`rahisi.theme`).
- **Admin app bar:** a "Light / Night / Auto" button (each tap moves to the next), then EN | FR, then Log out. The loose switch that sat under the Agents tab is gone. Agents still have the three-way switch in Profile.
- **Phone status bar** (`theme-color`) takes the page background of the active theme.
- **Tokens only:** the last hardcoded color (the dialog backdrop) is now `--overlay`, with a darker value for Night. New `--focus` token gives a visible keyboard focus ring in both themes.
- Smooth 0.2 s color transition when switching (off for people who ask for reduced motion), and a tighter admin bar on narrow phones.
- Not changeable per theme: the installed-app splash color comes from the manifest (`background_color`, light). Say if you want it set to the Night color instead.

## Step 7: French and the final language sweep

- **Complete:** every key exists in English and French, with the same `{placeholders}`. `npm test` (`src/lib/i18n.test.ts`) fails if a key is missing, a French text is identical to English by mistake, a French apostrophe is straight, or a page contains hardcoded visible English (button text, labels, `aria-label`, `placeholder`, `title`, `alt`). Only the brand name RAHISI CASH is left untranslated, on purpose.
- **Fixed in the sweep:** the language switch's screen-reader label, the amount placeholder (now `10 000` in French), the CSV phone column header, the page language (`<html lang>`) from the very first render, and the order description Pesapal shows to the client (now in the client's language: "Retrait Rahisi Cash").
- **French typography:** a no-break space before `?` `!` `;` `:` so these never wrap onto their own line. Money is `10 000 RWF` (English `RWF 10,000`).
- **Terms:** "Frais de transaction" (transaction fee), "Verser à l'agent" (the confirm button of the payout dialog), "Versement du jour" (Daily Payout). In the void dialog the dismiss button reads "Retour" so it cannot be confused with "Annuler la transaction".
- **Redeploy `create-payment`** (the Pesapal description changed). Nothing else on the server changed.

### Adding Kinyarwanda later

1. `src/lib/types.ts`: add `"rw"` to `Lang`.
2. Copy `src/i18n/fr.ts` to `rw.ts`, rename the export, translate the values (TypeScript lists every missing key).
3. `src/i18n/translate.ts`: add it to `dictionaries`. `src/i18n/index.tsx`: accept `"rw"` in `initialLang` (and in the phone-language check).
4. `src/components/Controls.tsx`: add the option to `LangSwitch`; `NewWithdrawal.tsx`: add it to the client language choice; the `create-payment` function and the database check on `language` columns (`'en','fr'`) must allow it too.
5. Formats: `src/lib/money.ts` (grouping), `src/lib/dates.ts` and `AgentsTab.tsx` (`Intl` locale), `src/lib/csv.ts` (separator).
Then extend the lists in `i18n.test.ts`.

## Change: Pesapal fee is 3.5% of what the client paid

- Run `supabase/migrations/0006_pesapal_fee_rate.sql` once. From then on, every payment that becomes "paid" gets `pesapal_fee = total_paid x 3.5%` (whole RWF, halves round up), stored on the transaction so a later rate change never alters past records. Payments already paid without a fee are filled in once by the same file.
- If Pesapal ever returns its real fee, it replaces the estimate. An admin can still correct one fee by hand (All Transactions > Pesapal fee).
- System Revenue and Balance now show Pesapal fees and net revenue for every payment (no more dashes).
- Fee Settings preview shows the Pesapal fee and the net after it, and warns when the system fee does not cover it.
- To change the rate: edit `v_rate` in the migration (re-run it) and `PESAPAL_FEE_PERCENT` in `src/lib/pesapal.ts`. A test fails if they differ.

## Change: prefilled Pesapal billing form

`create-payment` now sends Pesapal every billing field, so the client's page opens with the form already filled in:
first and last name, email (if the agent entered one), phone, country (from the phone number), and an address, city and postal code.
We do not collect an address, so those three use defaults: address `Kigali`, city `Kigali`, postal code `00000`.
To use different defaults, add optional secrets to the function: `PESAPAL_BILLING_LINE_1`, `PESAPAL_BILLING_CITY`, `PESAPAL_BILLING_POSTAL_CODE`.
Redeploy `create-payment` to apply this. It only affects links created after the redeploy.

What stays on Pesapal's side: the page still shows the billing box (filled in, and the client can edit it), the "I accept Pesapal's Privacy & Terms" tick box and the Proceed button. Pesapal's API has no option to hide them. The client enters the card number, expiry and CVV.

## Change: balance after Pesapal fees, and filters before every export

- **Balance tab:** the big card now shows "Your balance (after Pesapal fees)" = system fees minus Pesapal fees, with the sum written under it. If some payments have no Pesapal fee yet, it falls back to the system-fee balance with a note. Below: system fees, Pesapal fees, and what agents are owed (not paid yet) and have been paid so far. Paying agents does not reduce your balance: they are paid from the cash amount and commission the client pays, and you keep the system fee. "Reset my balance" still zeroes the system-fee ledger balance.
- **Filters before export (all four exports):** All Transactions and Orders (search, dates, agent, status), Payout History (dates, agent) and System Revenue (dates). The list, its totals and the CSV always use the same filters, and each page says so. File names include the date range.
- No database or Edge Function change: just redeploy the web app.

## Contact us and Privacy policy pages

- **Pages:** `/contact` and `/privacy`. Public (no login needed), English and French, light and night themes. Linked from a small "Contact us · Privacy policy" footer on Login, Register, Pending, Blocked, Profile, the page clients see after paying, and the admin portal.
- **Contact details** live in one file, `src/lib/contact.ts` (IT support 0780 322 005, support@rahisicash.com; sales and marketing 0789 552 231, 0787 788 472, info@rahisicash.com). The Contact page and the Privacy policy both read from it. Phone numbers open the dialer, emails open the mail app.
- **Policy text** is in the translation files under `privacy.*` (one section per id; add a bullet by adding the next `b` key and raising its count in `src/pages/Privacy.tsx`). Update `privacy.updated` whenever you change it.
- This is a plain-language draft. Have a lawyer review it before launch, especially: the law reference (Law No 058/2021), the retention wording, where data is stored, and the statement that deleting an account erases personal details and keeps financial records without a name.
