# Meta WhatsApp Business Cloud API — Complete Setup Guide

This guide covers everything needed to go from zero to sending real WhatsApp messages via the Cloud API, based on the exact setup used in this project (BookingAI / slam washermenpet).

---

## Understanding the Two Accounts You Have

Right now you have **two separate WhatsApp Business Accounts (WABAs)** which is causing confusion:

| Account | WABA | Phone Number | Status |
|---|---|---|---|
| Test WhatsApp Business Account | Auto-created by Meta | +1 555 651 9392 (test) | Works only in Dev mode |
| slam washermenpet | 3017744125063994 | +91 96262 53222 | **This is the real one to use** |

Your code's `WHATSAPP_PHONE_NUMBER_ID=1219573107896463` points at the **test number**, not the real one. This is why messages show 200 OK but don't reach real customers.

---

## Step 1 — Fix the App (BookingAI on developers.facebook.com)

The `BookingAI` app (App ID: 1024954329959812) is still in **Development mode**, which means:
- Webhooks don't fire for real users
- Messages only deliver to phone numbers you manually added to the test allowlist

### 1a. Add a Privacy Policy URL

Meta requires this before switching to Live.

**Quickest option — use a free generator:**
1. Go to [https://www.privacypolicygenerator.info](https://www.privacypolicygenerator.info)
2. Fill in: Company name = "Slam Washermenpet", Website URL = your domain, contact email
3. Generate → copy the hosted URL they give you (e.g. `https://www.privacypolicygenerator.info/live.php?token=XXXX`)

**Or create a `/privacy` page in your Next.js app** (ask the developer to add it) and use `https://yourdomain.com/privacy`.

**Where to paste it:**
- developers.facebook.com → **BookingAI app** → left sidebar → **App settings → Basic**
- Paste into the **"Privacy Policy URL"** field → Save Changes

### 1b. Switch App to Live

After saving the Privacy Policy URL:
- Top bar of the App Dashboard → toggle **App Mode: Development → Live**
- Meta may ask you to confirm App Review requirements — for WhatsApp Business API with a verified business, this is typically automatic.

---

## Step 2 — Register the Real Phone Number (+91 96262 53222)

The number shows **"Offline / Unavailable"** in WhatsApp Manager because it hasn't completed Cloud API registration.

### 2a. Check if the number is already on WhatsApp Business App

If `+91 96262 53222` is currently being used on the **WhatsApp Business mobile app**, you must **migrate it to Cloud API** first (or use a different number). A number can only be on one platform at a time.

To check: open the WhatsApp Business app on the phone using that number — if it's active there, you need to disconnect it before using Cloud API.

### 2b. Register the number via WhatsApp Manager

1. Go to **business.facebook.com → WhatsApp accounts → slam washermenpet → Phone numbers**
2. Click the gear icon (⚙) next to `+91 96262 53222`
3. Select **"Register"** or **"Set up two-step verification"**
4. Enter a 6-digit PIN (save this — you'll need it if you ever re-register)
5. Meta sends an OTP to the number to verify it
6. Once verified, status changes from "Offline" to **"Connected"**

### 2c. Get the phone_number_id for this number

1. Go to **developers.facebook.com → BookingAI app** (or whichever app is linked to the `slam washermenpet` WABA)
2. **WhatsApp → API Setup**
3. In the "From" dropdown, select `+91 96262 53222`
4. Below it you'll see: **Phone number ID: XXXXXXXXXXXXXXXXX** — copy this

---

## Step 3 — Generate a Permanent Access Token

The temporary token from API Setup expires in ~24 hours. You need a permanent System User token.

### 3a. Create a System User

1. Go to **business.facebook.com → Settings → Users → System users**
2. Click **Add** → name it (e.g. "BookingAI API User") → role: **Admin**
3. Click on the new system user → **Add assets**
4. Select **Apps → BookingAI** → give **Full control**
5. Select **WhatsApp accounts → slam washermenpet** → give **Full control**
6. Save

### 3b. Generate the token

1. Still on the system user page → click **Generate new token**
2. Select app: **BookingAI**
3. Select permissions:
   - `whatsapp_business_messaging` ✓
   - `whatsapp_business_management` ✓
4. Set expiration: **Never**
5. Generate → **copy and save the token immediately** (it won't be shown again)

---

## Step 4 — Update Your .env File

```env
WHATSAPP_PHONE_NUMBER_ID=<new phone_number_id for +91 96262 53222>
WHATSAPP_ACCESS_TOKEN=<permanent system user token from Step 3>
WHATSAPP_VERIFY_TOKEN=<any string you choose, e.g. "bookingai_webhook_secret_2024">
```

---

## Step 5 — Set Up the Webhook

This is how Meta sends you delivery updates (sent → delivered → read → failed). Without this, your `whatsapp_messages` table will always show status "sent" and never update.

### 5a. Configure in the App Dashboard

1. **developers.facebook.com → BookingAI → WhatsApp → Configuration**
2. Set **Callback URL**: `https://yourdomain.com/api/v1/webhooks/whatsapp/verify`
3. Set **Verify token**: exactly the value you set as `WHATSAPP_VERIFY_TOKEN` in `.env`
4. Click **Verify and save**
   - Meta makes a GET request to your callback URL with `hub.mode=subscribe` and your verify token
   - Your FastAPI endpoint at `GET /webhooks/whatsapp/verify` handles this automatically
   - ⚠ Your server must be running and publicly accessible at that domain for this to work

### 5b. Subscribe to webhook fields

After saving:
- Under **Webhook fields** → click **Manage**
- Enable: **messages** ✓ (this covers both inbound messages AND status updates)
- Subscribe

---

## Step 6 — Add a Payment Method

Without a payment method, Meta will block outbound messaging even after going Live.

1. **business.facebook.com → WhatsApp accounts → slam washermenpet → Payment configuration → India**
2. Add a credit/debit card or UPI payment method
3. Rough illustrative rates seen in 2025-2026 (Marketing conversations costing more than Utility, with free user-initiated/service messages inside the 24h window) — but **Meta has changed its billing model more than once** (conversation-based vs per-message in different markets), so check **WhatsApp Manager → Account tools → Messaging limits / Pricing** for the current exact India rates before budgeting — don't rely on a fixed number from this or any other guide.

---

## Step 7 — Understand Template Categories (Utility vs Marketing vs Authentication)

Before creating templates, know that Meta classifies every template into exactly one of three categories, and **picks the cost and the rules that apply based on category, not on what you call it**:

| Category | What it's for | Rule of thumb | Used in this project? |
|---|---|---|---|
| **Utility** | Transactional, service-related messages the customer's action triggered or that are essential to their experience (order/booking confirmations, reminders, account updates) | Must be **non-promotional** — no offers, no upsells, no persuasive language. Must be "requested by the user" or essential to their experience. | Yes — `booking_confirmation_*` |
| **Marketing** | Promotional and outreach communications — anything trying to acquire, re-engage, or sell to someone | Anything that doesn't cleanly qualify as Utility or Authentication defaults here. **Cold outreach to leads who haven't booked anything yet is Marketing, not Utility.** | Yes — `lead_intro_*`, `lead_followup_*`, `lead_offer_*`, `lead_lastchance_*` |
| **Authentication** | One-time passcodes / login verification only | Not applicable to appointment booking | No — not used in this project |

**Critical rule confirmed directly from Meta's developer docs:** if a template mixes Utility and Marketing content (e.g. an appointment reminder that also pushes a discount), Meta reclassifies the *entire template* as Marketing. Keep `booking_confirmation_*` strictly factual — name, service, time, nothing else — to keep it in the cheaper, less-restricted Utility category.

**Do not mislabel a Marketing template as Utility to save money or avoid opt-in rules.** Meta's review explicitly checks for this, and miscategorization risks the template being rejected, recategorized, or your account being flagged.

The same "appointment" content can be either category depending on who it's sent to:
- Reminding a customer who **already has a confirmed booking** → Utility.
- Promoting open slots or re-engaging a lead who **hasn't booked anything** → Marketing.

This is why this project's 4-step lead sequence templates (`lead_intro`, `lead_followup`, `lead_offer`, `lead_lastchance`) must be submitted as **Marketing**, while `booking_confirmation_*` stays **Utility**.

---

## Step 8 — Create and Approve All Message Templates

The code references these 15 templates by name. They must exist and be **Approved** in WhatsApp Manager before they'll send (a 404/`132001` error means the template name doesn't exist yet for that language).

| Template name | Language code | Category | Params | Used for |
|---|---|---|---|---|
| `booking_confirmation_en` | en | **Utility** | 3 | Booking confirmed (English) |
| `booking_confirmation_hi` | hi | **Utility** | 3 | Booking confirmed (Hindi) |
| `booking_confirmation_ta` | ta_IN | **Utility** | 3 | Booking confirmed (Tamil) |
| `lead_intro_en` / `_hi` / `_ta` | en / hi / ta_IN | **Marketing** | 2 | Lead outreach step 1 (day 0) |
| `lead_followup_en` / `_hi` / `_ta` | en / hi / ta_IN | **Marketing** | 2 | Lead outreach step 2 (day 2) |
| `lead_offer_en` / `_hi` / `_ta` | en / hi / ta_IN | **Marketing** | 2 | Lead outreach step 3 (day 4) |
| `lead_lastchance_en` / `_hi` / `_ta` | en / hi / ta_IN | **Marketing** | 2 | Lead outreach step 4 (day 6) |

### How to create each template

1. **business.facebook.com → WhatsApp accounts → slam washermenpet → Message templates → Create template**
2. Select the **Category** exactly as shown in the table above
3. Language: select the matching language
4. Template name: must match the table **exactly** (lowercase, underscores)
5. Body: use `{{1}}`, `{{2}}`, `{{3}}`… as placeholders, **sequential and never skipped**
6. Submit for review

### Recommended template content

`booking_confirmation_*` — params: `{{1}}` customer name, `{{2}}` service, `{{3}}` date/time

- **en:** `Hi {{1}}, your appointment for {{2}} is confirmed for {{3}}. If you need to reschedule, reply to this message or call us.`
- **hi:** `नमस्ते {{1}}, आपकी {{2}} की अपॉइंटमेंट {{3}} के लिए कन्फर्म हो गई है। समय बदलने के लिए इस मैसेज का जवाब दें या हमें कॉल करें।`
- **ta:** `வணக்கம் {{1}}, உங்கள் {{2}} சந்திப்பு {{3}} அன்று உறுதி செய்யப்பட்டது. நேரம் மாற்ற இந்த செய்திக்கு பதிலளிக்கவும் அல்லது எங்களை அழைக்கவும்.`

`lead_intro_*` (step 1) — params: `{{1}}` lead name, `{{2}}` business name

- **en:** `Hi {{1}}, this is {{2}}. We'd love to have you visit us! Reply YES to hear about our current offers, or STOP to opt out.`
- **hi:** `नमस्ते {{1}}, यह {{2}} की तरफ से है। हम आपको अपने यहाँ देखना चाहेंगे! ऑफर्स के बारे में जानने के लिए YES लिखें, या STOP लिखकर इसे बंद करें।`
- **ta:** `வணக்கம் {{1}}, இது {{2}} இடமிருந்து. உங்களை எங்கள் இடத்தில் சந்திக்க விரும்புகிறோம்! எங்கள் சலுகைகளை அறிய YES எனத் தட்டச்சு செய்யவும், அல்லது நிறுத்த STOP எனவும்.`

`lead_followup_*` (step 2) — params: `{{1}}` lead name, `{{2}}` business name

- **en:** `Hi {{1}}, just checking in — {{2}} still has a great offer waiting for you. Want to know more? Reply YES.`
- **hi:** `नमस्ते {{1}}, बस यह बताने के लिए कि {{2}} में आपके लिए एक बढ़िया ऑफर अभी भी उपलब्ध है। और जानना चाहते हैं? YES लिखें।`
- **ta:** `வணக்கம் {{1}}, {{2}} இல் இன்னும் ஒரு சிறந்த சலுகை உங்களுக்காக காத்திருக்கிறது. மேலும் அறிய விரும்புகிறீர்களா? YES எனத் தட்டச்சு செய்யவும்.`

`lead_offer_*` (step 3) — params: `{{1}}` lead name, `{{2}}` business name

- **en:** `Hi {{1}}, last chance to grab this offer from {{2}}! Reply YES to book your spot before it's gone.`
- **hi:** `नमस्ते {{1}}, {{2}} के इस ऑफर को पाने का आखिरी मौका! अपनी जगह बुक करने के लिए YES लिखें।`
- **ta:** `வணக்கம் {{1}}, {{2}} இலிருந்து இந்த சலுகையைப் பெற கடைசி வாய்ப்பு! உங்கள் இடத்தை பதிவு செய்ய YES எனத் தட்டச்சு செய்யவும்.`

`lead_lastchance_*` (step 4) — params: `{{1}}` lead name, `{{2}}` business name

- **en:** `Hi {{1}}, this is our final reminder from {{2}}. Reply YES anytime if you change your mind — we're here when you're ready.`
- **hi:** `नमस्ते {{1}}, यह {{2}} की तरफ से आखिरी रिमाइंडर है। यदि आप अपना मन बदलते हैं तो कभी भी YES लिखें - हम आपके लिए तैयार हैं।`
- **ta:** `வணக்கம் {{1}}, இது {{2}} இடமிருந்து எங்கள் இறுதி நினைவூட்டல். உங்கள் மனதை மாற்றினால் எப்போது வேண்டுமானாலும் YES எனத் தட்டச்சு செய்யவும் - நாங்கள் தயாராக இருக்கிறோம்.`

> The Hindi and Tamil wording above is a reasonable starting draft, not professionally localized — have a native speaker review phrasing before submitting, since awkward translations are more likely to be rejected or look unprofessional to customers.

### Why templates get rejected (and how to avoid it)

These are the most common rejection reasons reported across template-approval guides, beyond the official category rule above:

- **Promotional language inside a Utility template** — no "offer", "discount", "limited time", exclamation-heavy phrasing in `booking_confirmation_*`
- **Vague or generic content** — a template that's just placeholders with no real sentence structure gets flagged
- **Spelling/grammar errors** — proofread before submitting
- **Shortened links** (bit.ly, tinyurl, etc.) — use the full URL or none at all
- **Non-sequential variables** — `{{1}}` then `{{3}}` without a `{{2}}` will fail
- Submitting the same rejected template repeatedly without changing the wording rarely helps — re-read the rejection reason in WhatsApp Manager and revise specifically

Approval is usually automatic within minutes for clean Utility templates; Marketing templates can take longer and are reviewed more strictly.

---

## Step 9 — Complete Business Verification (Unlocks Higher Messaging Limits)

This is **separate from the phone number OTP verification in Step 2** — that only proves you control the phone number. Business Verification proves the *legal business* behind the WhatsApp account is real, and Meta uses it to decide how many customers you can message per day.

Every new WABA starts at a small messaging tier (a limited number of unique customers you can message in a rolling 24 hours). Your tier scales up over time based on **quality rating** (see Step 12) and **whether your business is verified** — an unverified business is capped lower and scales more slowly than a verified one.

### How to verify

1. **business.facebook.com → Settings → Business Info** (or **Security Center**) → **Start Verification**
2. Enter your **legal business name and address exactly as registered** — mismatches with your documents are the #1 cause of rejected verification
3. Upload an accepted document. For an Indian business, typically one of:
   - GST registration certificate
   - Udyam/MSME registration certificate
   - Certificate of Incorporation / business registration certificate
   - A recent utility bill or bank statement showing the business name and address
4. Submit and wait — this can take anywhere from a few hours to several business days
5. Once approved, your messaging tier increases automatically as you send quality messages; there's no manual "select your tier" step

> Treat this as something to start early — don't wait until you're hitting the messaging cap to begin verification, since the review can take days.

---

## Step 10 — Display Name Review

The name customers actually see on WhatsApp (e.g. "Slam Washermenpet") is reviewed and approved **separately** from the app/number setup.

1. **business.facebook.com → WhatsApp Manager → your phone number → Profile** (or during initial number setup)
2. Set the display name to match your real, recognizable business name — Meta rejects names that look generic, misleading, or unrelated to the registered business
3. Submit — review typically takes up to 24-48 hours
4. Until approved, the number may show a placeholder or the raw phone number to customers instead of your business name

---

## Step 11 — Test End-to-End

1. Restart your backend: `docker compose restart fastapi celery`
2. Create a test lead/customer with your own phone number
3. Trigger a WhatsApp send from the dashboard
4. Check logs: `docker compose logs -f fastapi | grep -i whatsapp`
5. Check the DB: `SELECT phone, status, wa_message_id FROM whatsapp_messages ORDER BY created_at DESC LIMIT 5;`
6. Status should progress: `sent` → `delivered` → `read` as the message is received

---

## Step 12 — Ongoing Compliance: Quality Rating & Block Rate

Getting set up isn't the end — Meta continuously scores your number, and a bad score can shrink your messaging tier or get the number restricted/banned outright.

- **Quality rating (High / Medium / Low)** — visible in WhatsApp Manager → Phone numbers. Driven by how many recipients block you, report you as spam, or leave conversations unanswered/ignored. A sustained Low rating can drop your messaging tier even after Business Verification raised it.
- **Block/report rate** — every opt-out or block counts against you. This is exactly why the suppression engine in this codebase (`is_opt_out`, `SuppressionList`) matters operationally, not just as a CLAUDE.md compliance checkbox — it directly protects your quality rating by stopping outreach the moment someone says stop, before they get annoyed enough to block or report you.
- **Don't re-message someone who opted out** even on a different campaign/sequence — the suppression list is checked globally across calls and WhatsApp for this reason.
- **Keep Marketing volume reasonable relative to engagement** — blasting the full lead list repeatedly with low reply rates is what drags quality rating down; the existing 4-step sequence with day-gaps (0/2/4/6) is a reasonable cadence, don't compress it further.
- **Pricing changes periodically** — Meta has shifted Marketing template billing models more than once (conversation-based vs per-message in different markets). Check **WhatsApp Manager → Account tools → Messaging limits / Pricing** for current India rates before estimating costs — don't rely on a fixed number from any guide, including this one.

---

## AI Auto-Reply Assistant (No Templates Needed for Conversations)

### Why templates aren't always required

Meta's template requirement only applies to **business-initiated** messages — i.e. when you message a customer first, or when more than 24 hours have passed since their last message to you (the customer must re-trigger a new "customer service window" before you can send free-form text again).

The rule, confirmed against Meta's own developer docs:

- **Customer messages you first** → opens a **24-hour customer service window**. Inside that window you can reply with **any free-form content** — including LLM-generated text — no template required, no extra charge.
- **Window resets** every time the customer sends a new message.
- **Window closes** after 24 hours of customer inactivity → you're back to template-only until they message again.
- **You message first** (reminders, renewal follow-ups, lead outreach, marketing) → **always requires an approved template**, regardless of any prior conversation. This is a hard platform rule, not something your code can bypass.

Meta also updated its WhatsApp Business Solution Terms (effective Jan 15, 2026) to ban *general-purpose* AI chatbots (open-domain assistants like a ChatGPT-on-WhatsApp clone) from the platform. This does **not** affect this project: Meta explicitly confirmed business-focused automation — order confirmations, appointment booking, support, reminders — remains fully permitted. An appointment-booking assistant for a gym/salon/restaurant is exactly the kind of "structured task" use case Meta calls out as allowed.

### What was built

| Outbound message type | Mechanism | Template needed? |
|---|---|---|
| First contact / lead outreach | `send_template_message` (existing) | **Yes** |
| Booking confirmation, reminders, renewal follow-ups | `send_template_message` / `send_booking_confirmation` (existing) | **Yes** |
| Reply to an inbound customer message | **New: AI assistant** via `send_text_message` | **No** — free-form, inside the 24h window |

New files:
- [backend/app/integrations/llm.py](../backend/app/integrations/llm.py) — OpenAI tool-calling loop wrapper
- [backend/app/services/whatsapp_assistant.py](../backend/app/services/whatsapp_assistant.py) — builds the system prompt (business name, type, city, per-location knowledge base, customer's preferred language, current IST date/time) and exposes 5 tools the LLM can call: `check_availability`, `book_appointment`, `list_my_appointments`, `reschedule_appointment`, `cancel_appointment` — all backed by your existing `app/services/appointment.py` and `app/services/availability.py` logic, so double-booking prevention and Google Calendar sync still apply.
- New Celery task `generate_and_send_ai_reply` in [backend/app/tasks/whatsapp_tasks.py](../backend/app/tasks/whatsapp_tasks.py)

Changed:
- [backend/app/api/v1/webhooks/whatsapp.py](../backend/app/api/v1/webhooks/whatsapp.py) — every inbound message now resolves which `Location` owns the receiving phone number (via the webhook's `metadata.phone_number_id`, matched against `Location.whatsapp_phone_number_id`), then enqueues `generate_and_send_ai_reply` so the assistant replies automatically.
- Suppressed/opted-out numbers are skipped (reuses the existing suppression check) — the assistant never messages someone who opted out.
- If a customer doesn't yet exist as a `Customer` record, one is auto-created on first WhatsApp message (`full_name="WhatsApp Customer"`, language defaults to English — update manually or let them tell the assistant their name).

### Setup required

1. **Get an OpenAI API key** — [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → Create new key.
2. Add to `.env` (already scaffolded with empty placeholders):
   ```env
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```
3. Restart: `docker compose restart fastapi celery`
4. **Fill in each location's knowledge base** — dashboard → Locations → a location's "AI Knowledge Base" field. This text is fed directly into the assistant's system prompt (hours, pricing, policies, services offered, anything customers ask about).
5. If `OPENAI_API_KEY` is left empty, the assistant gracefully no-ops (same stub pattern used elsewhere in this codebase) — inbound messages are still logged, just not auto-replied to.

### Testing

1. Message the connected WhatsApp number from your own phone: "Hi, do you have a slot tomorrow at 5pm for a haircut?"
2. Check Celery logs: `docker compose logs -f celery | grep -i "ai_reply\|whatsapp_assistant"`
3. Confirm the reply arrives on WhatsApp and that `whatsapp_messages` has a new `outbound` / `session` row with the AI's reply text.
4. Try a full booking flow end-to-end ("book me a haircut tomorrow at 5pm") and confirm an `Appointment` row + Google Calendar event were created with `booked_via = whatsapp`.

### Limits / things to know

- Conversation memory is the last 12 WhatsApp messages for that phone number (no separate session/thread concept — matches how WhatsApp itself has no explicit "end chat").
- The assistant only acts within one location at a time (the one tied to the phone number that received the message) — it cannot book across locations in a single chat.
- This still respects double-booking prevention: `book_appointment`/`reschedule_appointment` call the same `find_available_staff` logic the dashboard and call agent use, so a slot taken by one channel can't be re-booked by another.
- Outbound reminders, renewal follow-ups, and lead outreach are **unaffected** — they still go through Meta templates exactly as before. This feature only changes what happens after a customer messages you.

---

## Quick Checklist

- [ ] Privacy Policy URL added in App settings → Basic
- [ ] App switched to Live mode
- [ ] +91 96262 53222 registered (status = Connected) in WhatsApp Manager
- [ ] New `phone_number_id` copied for +91 96262 53222
- [ ] Permanent System User token generated
- [ ] `.env` updated with new `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN`
- [ ] Webhook Callback URL + Verify token set and verified
- [ ] Webhook subscribed to `messages` field
- [ ] Payment method added
- [ ] All 15 message templates created with the **correct category** (Utility for `booking_confirmation_*`, Marketing for `lead_*`) and approved in WhatsApp Manager
- [ ] Business Verification submitted (legal documents) — don't wait until you hit the messaging cap
- [ ] Display name submitted for review and approved
- [ ] End-to-end test passed (status reaches `delivered` in DB)
- [ ] `OPENAI_API_KEY` set in `.env` for AI auto-replies
- [ ] Location's knowledge base filled in (dashboard → Locations)
- [ ] Test conversation + test booking via WhatsApp confirmed end-to-end
- [ ] Quality rating checked in WhatsApp Manager (should be Medium/High, not Low)

---

## Common Errors and Fixes

| Error / Symptom | Cause | Fix |
|---|---|---|
| 200 OK but message not received | Test number, recipient not in allowlist | Switch to real number + Live mode |
| `error_code: 131030` in webhook | Recipient not in test allowlist | Add number to API Setup "To" list, or go Live |
| `error_code: 132001` | Template name doesn't exist or wrong language code | Create/approve the template in WhatsApp Manager |
| Status stuck at `sent`, never `delivered` | Webhook not configured or not subscribed | Complete Step 5 |
| `Invalid Privacy Policy URL` when going Live | Privacy policy URL missing or unreachable | Add a working https:// URL in App settings → Basic |
| `Missing payment method` warning | No payment method on WABA | Add credit card in WhatsApp Manager → Payment configuration |
| Phone number shows "Offline" | Number not registered for Cloud API | Complete Step 2b (register + verify via OTP) |
| Access token expired | Used temporary token from API Setup | Generate permanent System User token (Step 3) |
| Customer messages but gets no AI reply | `OPENAI_API_KEY` not set, or location's `whatsapp_phone_number_id` doesn't match the inbound webhook's `metadata.phone_number_id` | Set the key in `.env`; confirm the location in the dashboard has the correct phone_number_id saved |
| AI reply sent but couldn't book | No staff available for that slot, or `working_hours` not set for any staff at that location | Check Staff working hours in the dashboard for that location |
| Template rejected | Promotional language in a Utility template, vague content, spelling errors, shortened links, or non-sequential `{{n}}` variables | Re-read Meta's specific rejection reason in WhatsApp Manager and fix that exact issue — see Step 8 |
| Template approved but reclassified to Marketing | Body mixed transactional and promotional content | Remove any offer/discount/persuasive language from `booking_confirmation_*`; resubmit |
| Hit daily messaging limit ("tier" cap) | Business Verification not complete, or quality rating dropped | Complete Step 9; check quality rating in WhatsApp Manager |
| Customers see a phone number instead of business name | Display name not yet approved | Submit/wait on Step 10; can take 24-48 hours |
| Number flagged or restricted | High block/report rate, ignoring opt-outs, over-messaging leads | Audit suppression list is actually being honored; slow down lead outreach cadence |
