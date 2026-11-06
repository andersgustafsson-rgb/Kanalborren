# Verifierade fiskeregler – Malmö kanal (Etapp 0)

**Verifieringsdatum:** 2026-11-06  
**Status:** Primärkälla läst. Appen får bara visa regler som finns i denna fil (eller senare uppdateringar med ny källa/datum).

## Primärkällor

| Källa | Typ | Beslut / uppdatering | Lokal kopia / länk |
| --- | --- | --- | --- |
| Allmänna lokala ordningsföreskrifter för Malmö kommun | Styrdokument | KF beslut § 105, **2026-05-28**; diarienummer TN-2024-562, TN-2026-1932, STK-2025-1858 | [data/ordningsforeskrifter.pdf](../data/ordningsforeskrifter.pdf); [malmo.se författningssamling](https://malmo.se/Om-Malmo-stad/Demokrati-och-politik/Sa-styrs-Malmo/Forfattningssamling/Bestammelser-som-riktar-sig-till-dig-som-medborgare.html) (sidan uppdaterad 2026-11-02) |
| Bilaga 4 – Fiske | Kartbilaga till föreskrifterna | Samma beslut | [data/bilaga4-fiske.pdf](../data/bilaga4-fiske.pdf) |
| Fiske – Malmö stad (kommuninfo) | Sekundär sammanfattning | Sidan uppdaterad **2026-10-12** | https://malmo.se/Uppleva-och-gora/Fritidsaktiviteter/Fiske.html |
| Nya regler för ordningen… | Kommuninfo om ikraftträdande | Publicerad **2026-10-09** (länsstyrelsen godkänt) | https://malmo.se/Aktuellt/Artiklar-Malmo-stad/2026-10-09-Nya-regler-for-ordningen-pa-Malmos-offentliga-platser.html |
| Hamnordning Malmö hamn | Separata föreskrifter | Gäller hamnområde (bl.a. nätfiske) | [data/hamnordning.pdf](../data/hamnordning.pdf) |
| HaV fritidsfiske | Nationell vägledning | Sidan uppdaterad **2026-10-22** | https://www.havochvatten.se/fiske-och-handel/regler-och-lagar/fiskeregler-for-fritidsfiske.html |
| Svenska fiskeregler | Nationell regelkarta | — | https://svenskafiskeregler.se |

**Ansvar:** Överträdelse av lokala ordningsföreskrifter kan ge penningböter enligt 3 kap. 22 § andra stycket ordningslagen (föreskrifterna 25 §).

**App-disclaimer (obligatorisk):** Uppgifterna är en hjälp, inte juridisk rådgivning. Kontrollera alltid gällande primärkälla innan du fiskar.

---

## Regelposter för MVP (källa + datum + giltighet)

### R1 – Handredskap i innerkanalen

| Fält | Värde |
| --- | --- |
| Sammanfattning | Fiske i Malmö stads kanaler är tillåtet för allmänheten i kanalens hela sträckning **innanför Turbinbron, Neptunibron och Suellsbron**, endast med **handredskap**. |
| Handredskap | Spö, pilk och liknande rörligt redskap med lina och **högst tio krokar** (ordalydelse i 18 §). |
| Geografisk giltighet | Innerkanalen innanför nämnda broar; se Bilaga 4. |
| Källa | Ordningsföreskrifterna 18 §; Bilaga 4 |
| Källdatum | KF 2026-05-28; verifierad 2026-11-06 |
| Verifieringsstatus | **Verifierat** (primärtext) |
| App-polygon MVP | `allowed_canal_inner` (ungefärlig bbox tills Bilaga 4 digitaliseras) |

### R2 – Förbud Malmöhus vallgrav

| Fält | Värde |
| --- | --- |
| Sammanfattning | I vallgraven runt Malmöhus slott är fiske **inte** tillåtet. |
| Geografisk giltighet | Vallgraven runt Malmöhus; Bilaga 4 |
| Källa | 18 §; Bilaga 4; även malmo.se/fiske |
| Källdatum | KF 2026-05-28; malmo.se 2026-10-12 |
| Verifieringsstatus | **Verifierat** |
| App-polygon MVP | `forbidden_malmohus_moat` |

### R3 – Förbud fiske från broar

| Fält | Värde |
| --- | --- |
| Sammanfattning | Det är förbjudet att fiska **från broar**. |
| Geografisk giltighet | Alla broar som omfattas av föreskrifterna (offentlig plats); gäller kanaler och andra offentliga platser enligt tjänsteskrivelsens motiv. |
| Källa | 18 § |
| Källdatum | KF 2026-05-28 |
| Verifieringsstatus | **Verifierat** |
| App-hantering | Regeltext + tips-lager; individuella bropunkter kan läggas som “förbudszon/tips” utan att påstå bötesbelopp |

### R4 – Förbud Dockans hamninlopp

| Fält | Värde |
| --- | --- |
| Sammanfattning | Förbjudet att fiska **i anslutning till hamninloppet till Dockan**. |
| Geografisk giltighet | Dockans inlopp (Bilaga 4 / karttolkning) |
| Källa | 18 §; malmo.se/fiske |
| Källdatum | KF 2026-05-28 |
| Verifieringsstatus | **Verifierat** (text); exakt polygon kräver digitalisering av Bilaga 4 |
| App-polygon MVP | `forbidden_dockan_inlet` (ungefärlig) |

### R5 – Säsongsförbud badbryggor/badstränder

| Fält | Värde |
| --- | --- |
| Sammanfattning | Förbjudet att fiska från och i anslutning till allmänna badbryggor och badstränder **15 maj–30 september**. Förbudet omfattar även närmaste vattenområde som utnyttjas av badande. |
| Geografisk giltighet | Allmänna badbryggor och badstränder i kommunen (t.ex. Ribersborg, Sibbarp, Klagshamn enligt 3 § jämställda områden) |
| Källa | 18 § |
| Källdatum | KF 2026-05-28 |
| Verifieringsstatus | **Verifierat** |
| App-hantering | Säsongsflagga + länk; detaljpolygoner utanför kanal-MVP |

### R6 – Dammar i kommunens parker

| Fält | Värde |
| --- | --- |
| Sammanfattning | Fiske i dammar i kommunens parker får inte ske utan särskilt medgivande från tekniska nämnden. |
| Källa | 18 § |
| Verifieringsstatus | **Verifierat** |
| App-hantering | Utanför kanal-MVP; visa endast om användaren zoomar utanför kanalen |

### R7 – Hamnordning: nät, ryssjor, långrev

| Fält | Värde |
| --- | --- |
| Sammanfattning | Inom hamnområdet: fiske med nät, ryssjor eller långrev får inte ske (Hamnordning 26 §). |
| Källa | Hamnordning Malmö hamn |
| Verifieringsstatus | **Verifierat** för hamnområde; **gäller inte automatiskt** hela innerkanalen |
| App-hantering | Visa endast om lager “Hamn” aktiveras; undvik att blanda ihop med kanalregler |

---

## Medvetet utelämnat / ej påstått som fakta

- Exakta bötesbelopp (föreskriften anger penningböter via ordningslagen, inte belopp).
- Påståenden om “inga fiskekort i kanalen” som absolut sanning utanför kommunens formulering om tillåtet handredskapsfiske – visa kommunens egna ord.
- Artvisa minimimått / fredningstider: hänvisa till HaV / svenskafiskeregler.se, kopiera inte in i MVP utan egen verifiering per art.
- Sportfiskarnas tipsplatskarta: kan länkas, men är inte juridisk källa.

## Digitalisering kvarstår

Bilaga 4 är en kartbild. MVP använder ungefärliga GeoJSON-bboxar i `data/regelzoner.geojson` märkta `approximation: true` tills kartan digitaliserats noggrant (manuell spårning eller kommunens GIS-data).
