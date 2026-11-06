# Kontakt Malmö stad / Sensit – kanalsensorer

**Syfte:** Begära öppet eller licensierat API för vattenstånd i Malmö kanal (LoRa/Yggio), så Kanalborren kan visa lokal nivå istället för enbart Öresunds-proxy.

**Status 2026-11-06:** Utkast och sändlista klara. Meddelandet ska skickas från din egen adress (kommunen behöver avsändaridentitet). Kopiera texten nedan och skicka; logga svar i tabellen längst ner.

## Bakgrund (verifierat vs antagande)

| Uppgift | Status |
| --- | --- |
| Malmö stad mäter vattenstånd i kanaler/Öresund med IoT (LoRa, Yggio) | **Verifierat** via kommunens IoT-beskrivning på [dataportal.se](https://www.dataportal.se/exempel-datadriven-transformation/iot-datahantering-interoperabilitet-och-anvandarnytta-malmo-stads-resa) (läst 2026-11-06) och [Future by Lund](https://www.futurebylund.se/nyheter/14-sensorer-varnar-for-hoga-vattennivaer-i-malmo) |
| Data tillgängligt som öppna data för återpublicering i en app | **Ej bekräftat** – saknas som tydlig datasetpost för kanalnivå vid kontroll 2026-11-06 |
| Sensative/Yggio används som IoT-plattform | **Rapporterat** i leverantörs-/projektdokumentation; avtal måste gå via Malmö stad |

## Mottagare

| Till | Adress | Roll |
| --- | --- | --- |
| Primär | malmostad@malmo.se | Malmö stads kontaktcenter – begär vidarebefordran till Sensit / Fastighets- och gatukontoret / öppna data |
| Kopia (valfritt) | — | Om du får namngiven kontakt på Sensit eller öppna data, lägg till här |
| Referensportal | https://opendata.malmo.se | Kontrollera om dataset dyker upp efter förfrågan |

Telefon växel: 040-34 10 00 (vardagar 08–17).

## E-postutkast (svenska)

**Ämne:** Förfrågan om öppna/licensierade data – vattenstånd i Malmö kanal (Kanalborren)

Hej,

Jag utvecklar en lokal, icke-kommersiell (i första steget) PWA för sportfiskare kring Malmö kanal, arbetsnamn **Kanalborren**. Appen ska bland annat hjälpa användare att förstå vattenförhållanden och fiska säkert enligt gällande regler.

Jag har sett att Malmö stad mäter vattenstånd i kanalerna och Öresund via LoRa-sensorer och IoT-plattformen Yggio (beskrivet bland annat i kommunens IoT-arbete och öppna data-exempel).

**Fråga:** Finns vattenståndsdata från kanalsensorerna tillgängliga som öppna data, eller kan ni erbjuda ett licensierat API/avtal för återpublicering i en app för allmänheten?

Önskemål (gärna i denna prioritering):
1. Realtid eller nära-realtid vattenstånd per mätpunkt (eller aggregerat)
2. Stationsnamn/position, tidsstämpel och kvalitet/status
3. Licensvillkor för återpublicering (t.ex. CC BY eller motsvarande)
4. Eventuell kontaktperson för Sensit / öppna data

Tills dess använder vi SMHI:s publika oceanografiska data (t.ex. Malmö Hamn) som tydligt märkt **proxy för Öresund**, inte som mätning i kanalen.

Tack på förhand.

Med vänlig hälsning  
[Ditt namn]  
[E-post]  
[Telefon, valfritt]  
Projekt: Kanalborren

## Checklista innan du skickar

- [ ] Fyll i namn och kontaktuppgifter
- [ ] Bestäm om du beskriver projektet som hobby / ideell / framtida partnerskap
- [ ] Skicka från din egen e-post
- [ ] Spara skickat meddelande + ärendenummer om du får ett
- [ ] Uppdatera loggen nedan

## Kontaktlogg

| Datum | Åtgärd | Resultat | Nästa steg |
| --- | --- | --- | --- |
| 2026-11-06 | Utkast och mottagarlista skapade i repo | Redo att skickas av dig | Skicka mejl; uppdatera denna tabell med svar |
| | | | |

## Fallback tills avtal finns

Se [mvp-omfattning.md](mvp-omfattning.md): SMHI oceano vattenstånd (Malmö Hamn / Klagshamn) som **proxy**, alltid med källa, tidpunkt och osäkerhetsmärkning. Ingen kanalströmriktning i UI utan egen datakälla.
