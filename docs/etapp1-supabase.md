# Etapp 1 – Supabase

## Status (klart i kod)
- Check-in publicerar närvaro (zon/exakt) via lokal presence-bus **eller** Supabase.
- Andra fiskare syns på kartan (`OthersMarkers`).
- Åskådarläge / Dölj avslutar publikation.
- Magic link-UI finns när `.env.local` är satt.
- Utan nycklar: sätt visningsnamn på startsidan, öppna `/karta` i **två flikar**, simulera + checka in i zon/exakt — den andra fliken ser dig.

## Du gör (riktig sync)
1. Skapa projekt på [supabase.com](https://supabase.com).
2. Kör `supabase/schema.sql` i SQL Editor (**Run**).
3. Database → Publications / Realtime → slå på `fishing_sessions`.
4. Authentication → URL Configuration → Site URL + Redirect: `http://127.0.0.1:5173/**`
5. API-nycklar i `web/.env.local` (klart när du skickat dem).
6. Starta om `npm run dev`, logga in via **Profil** (magic link), sedan Soff-check-in.

## Senare i samma etapp
- Fiskesällskap-förfrågan + 1:1-chatt
- Server-satt `expires_at` via Edge Function
