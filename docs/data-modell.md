# Datamodell – status, chatt, expire (utkast)

Ingen implementation ännu. Detta är kontraktet för Etapp 1.

## Kärnentiteter

### `profiles`
- `id` (uuid)
- `display_name`
- `email` (verifierad)
- `birth_year` eller `age_attested_16_plus` (bool)
- `created_at`
- `banned_at` (nullable)

### `fishing_sessions` (kartstatus)
- `id`
- `user_id`
- `mode`: `fishing_now` | `planned`
- `visibility`: `ghost` | `zone` | `precise`
- `zone_id` (nullable om ghost utan zonlista; krävs för zone/precise och för ghost+open)
- `lat` / `lng` (nullable; endast om `precise`; server-snappad/avrundad)
- `open_for_company` (bool, default false)
- `target_species` (text, optional)
- `note` (max 200 tecken)
- `starts_at`
- `expires_at` (**server-satt**)
- `ended_at` (nullable; manuell avslut)
- `last_heartbeat_at`

**Index:** aktiva sessioner där `ended_at is null and expires_at > now()`.

### `company_requests`
- `id`
- `from_user_id`
- `to_user_id`
- `session_id` (mottagarens session)
- `message`
- `proposed_time` (nullable)
- `status`: `pending` | `accepted` | `declined` | `expired` | `cancelled`
- `expires_at` (default +2 h)
- `created_at`

### `chats` / `chat_messages`
- Skapas vid `accepted`
- Två deltagare; inga telefonnummer
- `body` text; ingen bilaga i MVP (minskar moderering)

### `blocks` / `reports`
- `blocker_id` / `blocked_id`
- `reports`: reporter, target (user|message|hazard|catch), reason, notes, status

### `catch_reports` (Etapp 2)
- Default `visibility_scope`: `zone`
- Art, längd, tid, bete, teknik, `zone_id`, optional precise (opt-in)

### `hazards` (Etapp 2)
- Typ, zon, avstånd från kaj, datum, säkerhetsgrad, confirm/flag counters
- Disclaimer-flagga alltid i API-svar

### `rule_features`
- Från `data/regelzoner.geojson` + metadata (källa, datum)

## Expire-jobb

- Periodisk jobb (t.ex. varje minut) sätter `ended_at` eller filtrerar bort expired.
- Klient visar countdown; server är sanning.

## Integritetsteknik

- Lagra inte kontinuerlig GPS-spårning.
- Precise coords: avrunda till ~50–80 m innan lagring.
- Retention: avslutade publika sessioner raderas eller anonymiseras efter **7 dagar**; chatt efter **30 dagar** (eller vid raderingsbegäran).
- Blockade par syns aldrig för varandra i queries.
