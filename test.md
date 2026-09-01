# Dusk AI — Quick End-to-End Test

Live: **https://duskai.net** · tick each `[ ]` after the result matches.

**Before you start:** log in, and for WhatsApp tests switch to the **SLAM Lifestyle...** location (that's the one with approved templates). Have **two phone numbers you control** — Meta silently drops marketing messages to some numbers (error 130472), so a second number matters.

---

## Auth & shell
- [ ] Login with correct password → lands on Select Location.
- [ ] Wrong password → "Invalid email or password".
- [ ] Sidebar shows all pages; **Switch location** works.
- [ ] Sign Out → back to login; can't reach /dashboard without logging in.

## Dashboard
- [ ] Numbers load, no red errors in browser console (F12).

## Appointments
- [ ] Create an appointment → appears in list.
- [ ] Book same staff + same time again → blocked (no double-booking).
- [ ] Edit time, then Cancel → both work.

## Memberships
- [ ] Add a membership → appears; filters work.
- [ ] "Trigger renewal call" on a pending one → toast "queued"; test number rings.
- [ ] Paid membership → renewal call blocked.

## Leads
- [ ] Add a lead (your WhatsApp number, +91) → toast "outreach started", status New.
- [ ] Within ~1 min: test number gets a **call**; a **WhatsApp** message arrives (if number isn't experiment-blocked).
- [ ] Import CSV/Excel (`full_name,phone`) → "Imported X" toast; rows appear.
- [ ] Convert / Stop / Delete a lead → each works.
- [ ] Follow-up date shows (red if past).

## Campaigns  ← newest
**Voice call campaign**
- [ ] New Campaign → audience "All customers" → **Voice calls** → offer message → **Preview reach** shows a count → Launch → calls go out staggered.

**WhatsApp broadcast** (on the SLAM location)
- [ ] New Campaign → **WhatsApp** → template dropdown lists your approved templates.
- [ ] Pick `lead_intro_en`, fill var1 `{name}`, var2 business name → Launch → message arrives on a **fresh** number within ~1 min.
- [ ] Import CSV/Excel with **WhatsApp** channel → same result from an uploaded list.
- [ ] History shows the campaign with channel + queued count.

## Customers / Staff / Locations
- [ ] Customers list + search work.
- [ ] Add/edit a staff member → shows up when booking.
- [ ] Locations: Connect WhatsApp fields save; knowledge base saves.

## WhatsApp reply follow-up
- [ ] Reply to any WhatsApp message from your phone → the AI replies (needs OpenAI key set) and can check availability / book.
- [ ] Send "STOP" → you're suppressed; no further calls or messages.

## Responsive
- [ ] Narrow window / phone → sidebar collapses, tables scroll sideways, no horizontal page scroll.

---

## Known (not bugs — don't chase)
- **WhatsApp not delivered but log says sent** = Meta 130472 experiment on that number → try another number.
- **Templates missing in a WhatsApp campaign** = you're on a location whose WABA has none → use the **SLAM** location.
- **"AI assistant unavailable" reply** = OpenAI API key not set on the server yet.
- **Call History empty** = Bolna webhook must point to `https://duskai.net/api/v1/webhooks/bolna/call-outcome`.

## Issues found
| Page | Did | Got | Expected |
|------|-----|-----|----------|
|      |     |     |          |
