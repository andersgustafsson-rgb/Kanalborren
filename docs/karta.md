# Kartprototyp

## Köra lokalt

```bash
cd web
npm install
npm run dev
```

Öppna adressen Vite skriver ut (vanligen http://127.0.0.1:5173).

## Vad som visas

- **Baskarta:** Esri World Street Map (prototyp utan API-nyckel) – zoom 13–19, begränsad till Malmö. Byt till MapTiler/OpenFreeMap innan tung trafik.
- **Kanalytan:** OSM multipolygon `water=canal` (ODbL)
- **Vallgrav:** OSM `water=moat` (markerad som förbud)
- **Broar:** OSM-namngivna broar (tips om broförbud)
- **Zoner:** sociala synlighetszoner (ungefärliga)
- **Regler:** ungefärliga polygoner (av som default)

## Uppdatera kanalkälla

```bash
# Ladda om OSM-utdrag (bbox kring kanalen)
# sedan:
python scripts/extract_canal_geojson.py
copy data\*.geojson web\public\geo\
```

## Attribution (obligatorisk)

© OpenStreetMap contributors (ODbL) · CARTO · Malmö stad för regeltext
