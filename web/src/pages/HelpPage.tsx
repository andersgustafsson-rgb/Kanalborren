import { Link } from "react-router-dom";
import "./HelpPage.css";

const SECTIONS = [
  {
    id: "start",
    title: "Kom igång",
    body: [
      "Skapa konto under Profil → Konto (e-post + lösenord).",
      "Välj visningsnamn och avatar — det syns på kartan.",
      "Öppna Kartan när du är vid kanalen (eller testa med Soff-check-in hemma).",
    ],
  },
  {
    id: "karta",
    title: "Kartan & check-in",
    body: [
      "Till kanalen = åskådarläge (du tittar, syns inte som fiskande).",
      "Min GPS / Soff-check-in / Peka plats = sätt position, sedan Checka in.",
      "Synlighet: Ghost (dold), Zon (rekommenderas), Exakt (mer detalj).",
      "Öppen för fiskesällskap = separat kryss — då kan andra fråga dig.",
      "Dra i kartan så fälls check-in-menyn ihop.",
    ],
  },
  {
    id: "sallskap",
    title: "Fiskesällskap",
    body: [
      "Knappen Sällskap (nere till vänster på kartan) är en enda ruta.",
      "Fråga om sällskap → mottagaren trycker Acceptera & chatta.",
      "Slå på chatt-notiser i rutan om du vill ha ping vid nya meddelanden.",
    ],
  },
  {
    id: "fangst",
    title: "Fångster & Kanal-toppen",
    body: [
      "På Hem: rapportera art + längd och/eller vikt (+ zon).",
      "Topplistan visar största fångster per vecka, månad och år.",
      "Fångster sparas i molnet och syns för andra inloggade.",
    ],
  },
  {
    id: "utmana",
    title: "Utmana fiskare",
    body: [
      "På Hem: välj person, art, längd eller vikt, och tid (6–24 tim).",
      "Mottagaren antar → båda fiskar och rapporterar fångst.",
      "Tryck Avgör nu när tiden är slut (eller tidigare) — störst vinner.",
      "Ingen fångst hos någon = oavgjort.",
    ],
  },
  {
    id: "tips",
    title: "Tips",
    body: [
      "Lägg till på hemskärmen för app-känsla (Safari/Chrome).",
      "Egen domän kan kopplas senare via Cloudflare + Render.",
      "Admin-dashboard finns för dig som ägare under Profil.",
    ],
  },
];

export function HelpPage() {
  return (
    <div className="help-page">
      <div className="help-stack">
        <nav className="help-nav">
          <Link to="/">← Hem</Link>
          <Link to="/karta">Karta</Link>
          <Link to="/profil">Profil</Link>
        </nav>

        <header className="help-hero">
          <p className="help-eyebrow">KanalHugget</p>
          <h1>Så funkar det</h1>
          <p>
            Kort manual — karta, sällskap, fångster och utmaningar. Inget krångel.
          </p>
        </header>

        {SECTIONS.map((s) => (
          <section key={s.id} className="help-card" id={s.id}>
            <h2>{s.title}</h2>
            <ol>
              {s.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
        ))}

        <Link className="cta help-cta" to="/karta">
          Öppna kartan
        </Link>
      </div>
    </div>
  );
}
