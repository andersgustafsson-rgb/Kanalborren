# Kanalborren

Lokal fiskekarta och community för sportfiskare i **Malmö kanal**.  
Status: **Etapp 0 klar** (verifiering, integritet, MVP-lås). Ingen appkod ännu.

## Etapp 0 – leverabler

| Dokument | Innehåll |
| --- | --- |
| [docs/regler-verifiering.md](docs/regler-verifiering.md) | Verifierade lokala fiskeregler med källa och datum |
| [docs/kontakt-malmo-kanalsensorer.md](docs/kontakt-malmo-kanalsensorer.md) | E-postutkast till Malmö stad om kanalsensor-API |
| [docs/zoner-integritet-sallskap.md](docs/zoner-integritet-sallskap.md) | Sociala zoner, Ghost/Zon/exakt, expire, sällskapsflöde |
| [docs/data-modell.md](docs/data-modell.md) | Datamodell för status/chatt/expire |
| [docs/integritetspolicy-utkast.md](docs/integritetspolicy-utkast.md) | Integritetspolicy-utkast |
| [docs/anvandarvillkor-utkast.md](docs/anvandarvillkor-utkast.md) | Användarvillkor-utkast |
| [docs/mvp-omfattning.md](docs/mvp-omfattning.md) | Låst MVP (4 kärnfunktioner + SMHI-proxy) |
| [data/regelzoner.geojson](data/regelzoner.geojson) | Ungefärliga regelpolygoner |
| [data/sociala-zoner.geojson](data/sociala-zoner.geojson) | Sociala zoner |
| [data/ordningsforeskrifter.pdf](data/ordningsforeskrifter.pdf) | Primärkälla (KF 2026-05-28) |
| [data/bilaga4-fiske.pdf](data/bilaga4-fiske.pdf) | Kartbilaga fiske |

## MVP i korthet

1. Social karta + fiskesällskap  
2. Fångstrapporter + loggbok  
3. Risk-/bottenskarta  
4. Verifierade regler  

Stöd: SMHI Öresunds vattenstånd som **proxy** (inte kanalmätning).

## Din nästa manuella åtgärd

Skicka mejlet i `docs/kontakt-malmo-kanalsensorer.md` från din egen adress och uppdatera kontaktloggen.

## Kartprototyp (klar att prova)

```bash
cd web
npm install
npm run dev
```

Öppna http://127.0.0.1:5173 — zoom/pan, kanallager från OpenStreetMap, zoner/broar/regler.  
Mer: [docs/karta.md](docs/karta.md)

## Nästa utvecklingssteg

Social status + fiskesällskap ovanpå kartan (Etapp 1 resten) enligt `docs/mvp-omfattning.md`.
