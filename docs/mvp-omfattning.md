# MVP-omfattning – bekräftad riktning

**Bekräftat:** 2026-11-06  
**Grund:** Genomförbarhetsplanen *KanalHugget – genomförbarhet och MVP* + Etapp 0-leverabler i detta repo.  
**Tolkningsregel:** Att planen genomförs enligt specifikationen utgör klartecken för denna avgränsade MVP. Appkod startar först i **Etapp 1** efter att Etapp 0-filerna finns (detta dokument).

## Fyra kärnfunktioner (MVP)

1. **Social fiskekarta + fiskesällskap**  
   Status (fiskar nu / planerar), zon/ghost/exakt, separat “Öppen för fiskesällskap”, förfrågan, 1:1-chatt, expire, block/report.  
   Detaljer: [zoner-integritet-sallskap.md](zoner-integritet-sallskap.md), [data-modell.md](data-modell.md).

2. **Fångstrapporter + personlig loggbok**  
   Art, längd, tid, bete/teknik; default **zon**; färska rapporter med tidsfilter och disclaimer (“ingen garanti att fisk finns där nu”).

3. **Crowdsourcad risk-/bottenskarta**  
   Typ, zon, avstånd från kaj, datum, säkerhetsgrad, bekräfta/flagga + disclaimer.

4. **Regler & säkert fiske (verifierat)**  
   Regelposter från [regler-verifiering.md](regler-verifiering.md) + ungefärliga polygoner i `data/regelzoner.geojson`; källa, datum, giltighet; länk till HaV/svenskafiskeregler.

## Stödjande widget (inte kärnfunktion #1–4)

**Öresunds vattenstånd (proxy)** via SMHI oceano öppna data:

| Parameter | Stationer (prioritet) | API |
| --- | --- | --- |
| Havsvattenstånd | Malmö Hamn (35152), Klagshamn (2095) | `https://opendata-download-ocobs.smhi.se/api/version/1.0/...` |

UI måste visa: värde, tidpunkt, station, kvalitetskod om tillgänglig, texten **“Proxy för Öresund – inte mätning i kanalen”**.

Kanaltemperatur, kanalströmriktning och abborre↔ström-hypotesen ingår **inte** i MVP.

## Utanför MVP (senare etapper)

- Kajhöjd / långhåv  
- Kanal-toppen / mätbräda-tävling  
- Anslagstavla  
- Full offline-karta  
- QR-skyltar på kommunal mark  
- Malmö kanalsensor-API (pågår via [kontakt-malmo-kanalsensorer.md](kontakt-malmo-kanalsensorer.md))  
- Automatisk korrelation abborre↔ström  

## Teknikstack (låst för Etapp 1)

| Lager | Val |
| --- | --- |
| Klient | Vite + React PWA |
| Karta | Leaflet + billig tile-provider (MapTiler / Stadia / OpenFreeMap) – **inte** OSMF tile.openstreetmap.org i produktion |
| Backend | Supabase (Auth, Postgres/PostGIS, Realtime) som snabb start |
| Auth | Magic link eller OAuth + verifierad e-post |
| Notiser | Web Push efter hemskärmsinstall (iOS) – begränsad reach accepterad |
| Bilder | Av i första social-MVP; optional i Etapp 2 |

Kostnadsmål tidigt: &lt; ~50 EUR/mån (free tiers + liten hosting).

## Defaults som är låsta

| Fråga | Beslut |
| --- | --- |
| Organisationsform | Privat hobby / tidig community (kan bli ideell senare) |
| Geografi | Innerkanalen (Turbinbron / Neptunibron / Suellsbron) |
| Minimiålder | 16+ |
| Synlighet default | Zon-läge; exakt punkt opt-in |
| Öppen för sällskap | Separat toggle, default av; tillåtet i zonlista även i ghost |
| SMHI-proxy | Ja i v1 |
| Moderering | Du själv första 3–6 månaderna |
| Fångstrapporter | Default zon |
| QR på kommunal mark | Skippa tills produkten bevisats |

## Etapper

| Etapp | Innehåll | Kod? |
| --- | --- | --- |
| **0** (denna) | Regler, kontaktutkast, zoner/integritet, MVP-lås | Nej |
| **1** | Social MVP | Ja – efter denna bekräftelse |
| **2** | Rapporter, risker, reglerlager, SMHI-widget | Ja |
| **3+** | Push, bilder, kajhöjd, anslagstavla, kommundata | Ja |

## Klart för Etapp 1 när

- [x] Regler verifierade mot primärkälla  
- [x] Kontaktutkast till Malmö stad klart (att skickas av dig)  
- [x] Zoner, synlighet, expire, sällskapsflöde beslutade  
- [x] MVP-omfattning låst (detta dokument)  
- [ ] Du skickar mejlet om kanalsensorer (operativt, blockerar inte Etapp 1)  
- [ ] Digitisering av Bilaga 4 till mer exakta polygoner (förbättring under Etapp 2 reglerlager)
