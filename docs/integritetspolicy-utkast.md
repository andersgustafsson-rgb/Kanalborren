# Integritetspolicy – utkast (Kanalborren)

**Status:** Utkast för Etapp 0. Inte juridisk granskning. Uppdatera innan publik lansering.  
**Senast uppdaterad:** 2026-11-06

## Personuppgiftsansvarig

[Ditt namn / förening]  
Kontakt: [e-post]

## Vilka uppgifter vi behandlar

| Uppgift | Syfte | Laglig grund (utkast) |
| --- | --- | --- |
| E-post, lösenord/OAuth | Konto, säkerhet | Avtal / berättigat intresse (säkerhet) |
| Visningsnamn | Community | Avtal |
| Åldersintyg (16+) | Skydda minderåriga | Rättslig förpliktelse / berättigat intresse |
| Zon eller frivillig ungefärlig position | Visa fiskestatus / hitta sällskap | Samtycke + avtal |
| Chattinnehåll | Fiskesällskap | Avtal |
| Fångst-/riskrapporter | Community-karta | Avtal / samtycke |
| Block/report-metadata | Säkerhet och moderering | Berättigat intresse |
| Tekniska loggar (IP, device) | Drift och missbruksskydd | Berättigat intresse |

Vi ber **inte** om telefonnummer för publik profil. Plats delas bara när du aktivt checkar in.

## Synlighet du styr

- **Ghost Mode** – ingen kartmarkering.
- **Zon-läge** (default) – endast namngiven zon.
- **Exakt punkt** – opt-in, avrundad.
- **Öppen för fiskesällskap** – separat val (default av).
- **Dölj nu** – tar bort markering omedelbart.
- Markeringar **går ut automatiskt** (se zoner-integritet-sällskap).

## Delning

Vi säljer inte personuppgifter. Delning kan ske med:
- Hostingleverantör i EU (eller motsvarande skyddsåtgärder)
- Myndighet om lag kräver det

Andra användare ser endast det du aktivt gjort synligt (zon/status/chatt efter accept).

## Lagringstid (förslag)

| Data | Retention |
| --- | --- |
| Aktiv session | Till expire / manuell avslut |
| Avslutad publik status | Upp till 7 dagar, sedan raderas/anonymiseras |
| Chatt | Upp till 30 dagar, eller tidigare vid radering |
| Report-ärenden | Så länge som behövs för utredning (max 12 månader som mål) |
| Konto | Tills du raderar kontot |

## Dina rättigheter

Du kan begära registerutdrag, rättelse, radering, begränsning och invändning enligt GDPR. Kontakta [e-post]. Du kan klaga till Integritetsskyddsmyndigheten (IMY).

## Minderåriga

Tjänsten är avsedd för personer **16 år eller äldre** i MVP.

## Säkerhet (översikt)

- Verifierad e-post
- Rate limits på förfrågningar
- Block och report
- Ingen bakgrundsspårning i PWA
- DPIA rekommenderas innan bred lansering av social platsfunktion
