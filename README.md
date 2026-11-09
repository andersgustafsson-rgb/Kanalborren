# KanalHugget

Lokal fiskekarta och community för sportfiskare i **Malmö kanal**.

Status: **live PWA** (`web/`) med karta, check-in, fångster, sällskap, utmaningar och admin — backed by Supabase.

## App

```bash
cd web
npm install
npm run dev
```

Öppna http://127.0.0.1:5173. Produktion: Render (byggkatalog `web`).

## Etapp 0 – underlag

| Dokument | Innehåll |
| --- | --- |
| [docs/regler-verifiering.md](docs/regler-verifiering.md) | Verifierade lokala fiskeregler med källa och datum |
| [docs/kontakt-malmo-kanalsensorer.md](docs/kontakt-malmo-kanalsensorer.md) | E-postutkast till Malmö stad om kanalsensor-API |
| [docs/zoner-integritet-sallskap.md](docs/zoner-integritet-sallskap.md) | Sociala zoner, Ghost/Zon/exakt, expire, sällskapsflöde |
| [docs/data-modell.md](docs/data-modell.md) | Datamodell för status/chatt/expire |
| [docs/integritetspolicy-utkast.md](docs/integritetspolicy-utkast.md) | Integritetspolicy (**utkast** — kontrollera innan juridisk användning) |
| [docs/anvandarvillkor-utkast.md](docs/anvandarvillkor-utkast.md) | Användarvillkor-utkast |
| [docs/mvp-omfattning.md](docs/mvp-omfattning.md) | Låst MVP (4 kärnfunktioner + SMHI-proxy) |
| [docs/karta.md](docs/karta.md) | Kartlager och geojson |

Geo/data: `data/` och `web/public/geo/`. SQL: `supabase/`.

## MVP i korthet

1. Social karta + fiskesällskap  
2. Fångstrapporter + loggbok  
3. Risk-/bottenskarta  
4. Verifierade regler  

Stöd: SMHI Öresunds vattenstånd som **proxy** (inte kanalmätning).

## Kända luckor

- **Ghost + öppen för sällskap:** Syns i Ute/Sällskap utan kartnål när zon + sällskapsflagga är på (se docs).
- Integritetspolicy/villkor är utkast tills de granskats och publicerats med aktuell kontakt.
