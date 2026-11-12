import { Link } from "react-router-dom";
import "./HelpPage.css";

const SECTIONS = [
  {
    id: "start",
    title: "Kom igång",
    body: [
      "Skapa konto under fliken Profil på Hem (e-post + lösenord).",
      "Välj visningsnamn och avatar — det är så andra ser dig på kartan.",
      "Startsidan har två knappar: Starta fiskepass (du ska fiska) och Till kanalen (du vill bara titta på kartan).",
      "Flikarna under knapparna: Hem, Fångst, Utmana, Tips och Profil.",
    ],
  },
  {
    id: "pass",
    title: "Fiskepass",
    body: [
      "Tryck Starta fiskepass på startsidan när du går ut. Du stannar kvar på Hem — inget tvingar dig till kartan.",
      "Ett pass varar i 4 timmar och avslutas automatiskt efter det.",
      "Med pass igång räcker det att trycka Jag är vid kanalen på kartan — då checkas du in direkt enligt ditt val under Vad andra ser.",
      "Avsluta passet i kartmenyn längst ner (Fiskepass → Avsluta pass). Då checkas du också ut och syns inte längre som ute.",
    ],
  },
  {
    id: "karta",
    title: "Kartan & check-in",
    body: [
      "Till kanalen = åskådarläge. Du tittar på kartan men syns inte som fiskande.",
      "Checka in: tryck Jag är vid kanalen (hämtar GPS), sedan Checka in. En check-in varar 4 timmar och kan förlängas med +30 min.",
      "Vad andra ser: Dold (ingen ser dig), Ungefärlig plats (bara zonen) eller Exakt plats (nära där du står). Appen kommer ihåg ditt senaste val.",
      "Öppen för fiskesällskap är ett separat val. Med Dold + sällskap syns du i zonlistan men utan nål på kartan.",
      "Knappen Ute högst upp visar vilka som fiskar just nu och senaste fångsterna i zonerna.",
      "Avsluta turen när du går hem — du kan skriva en kort anteckning om dagen.",
      "Dra i kartan så fälls menyn ihop. Siktet-knappen nere till vänster centrerar på dig.",
    ],
  },
  {
    id: "parkering",
    title: "Parkering",
    body: [
      "Tryck på P-skylten nere till vänster på kartan.",
      "Visa parkeringar slår på parkeringslagret på kartan.",
      "Parkera bilen sätter en privat bilpin där du står — bara du ser den.",
      "Hitta min bil flyttar kartan till där bilen står. Ta bort bilpin när du har kört hem.",
    ],
  },
  {
    id: "sallskap",
    title: "Fiskesällskap",
    body: [
      "Knappen Sällskap nere till vänster på kartan samlar allt på ett ställe.",
      "Fråga om sällskap → mottagaren trycker Acceptera & chatta.",
      "Slå på chatt-notiser i rutan om du vill ha ping vid nya meddelanden.",
    ],
  },
  {
    id: "vader",
    title: "Väder & vatten",
    body: [
      "Kortet överst på Hem. All data kommer från SMHI — samma som på smhi.se.",
      "Bilden byts efter vädret: sol, mulet, regn, snö eller solnedgång.",
      "Vind visas med en pil som pekar åt det håll vinden kommer ifrån.",
      "Vattentemp och vattenstånd mäts i Öresund vid Malmö hamn. Vattenståndet visar hur mycket det ändrats senaste 3 timmarna.",
      "Fiskeförhållanden ger ett betyg 1–10 utifrån vind, vattentemp, regn och lufttryck — med en kort förklaring till varför.",
    ],
  },
  {
    id: "fangst",
    title: "Logga fångst",
    body: [
      "Snabbast: den runda Logga fisk-knappen nere till höger. Håll inne för att logga samma art och zon som senast.",
      "Vill du fylla i allt (längd, vikt, bild): fliken Fångst på Hem.",
      "Fångster sparas i molnet och syns för andra inloggade, om du inte gör dem privata.",
      "Logga minst en fångst per dag för att hålla din streak vid liv.",
    ],
  },
  {
    id: "toppen",
    title: "Kanal-toppen",
    body: [
      "Topplistan på Hem visar största fångsterna per Vecka, Månad, År eller All time.",
      "Topp 3 får guld, silver och brons. Tryck Visa hela topplistan för fler.",
      "Längd räknas i första hand — fångster med bara vikt visas i kg.",
    ],
  },
  {
    id: "pb",
    title: "Personbästa & dela",
    body: [
      "I fliken Profil fyller du i ditt personbästa per art, både längd och vikt.",
      "Appen jämför med det största du loggat. Slår du ditt rekord låses PB-looken upp i delningen.",
      "Efter en fångst kan du trycka Dela bild och välja look, foto och bakgrund.",
      "PB-delningen är privat — inget publiceras automatiskt, du väljer själv var bilden hamnar.",
    ],
  },
  {
    id: "utmana",
    title: "Utmana fiskare",
    body: [
      "På Hem → fliken Utmana: sök upp person (även hemma), välj art, längd eller vikt, och tid (6–24 tim).",
      "Folk som är ute vid kanalen syns först i listan — annars sök på namn.",
      "Mottagaren får notis och antar → båda fiskar och rapporterar fångst (rätt art under tiden).",
      "Poängen syns i utmaningsrutan (Du / motståndare).",
      "Tryck Avgör nu när ni är klara — eller vänta: efter sluttid avgörs den automatiskt.",
      "Ingen fångst hos någon = oavgjort. Obesvarade utmaningar blir ogiltiga efter tiden.",
      "Klara / nekade / utgångna utmaningar syns max ca 24 timmar — sen städas listan.",
    ],
  },
  {
    id: "tips",
    title: "Tips",
    body: [
      "Den här sidan hittar du via Bruksanvisning längst ner på Hem, eller Så funkar det i Profil.",
      "Fliken Tips: skicka buggar, förbättringar och tips till admin.",
      "Lägg till på hemskärmen för app-känsla (Safari/Chrome).",
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
            Kort manual — fiskepass, karta, väder, fångster, topplista och
            utmaningar. Inget krångel.
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

        <nav className="help-nav" style={{ justifyContent: "center" }}>
          <Link to="/integritet">Integritetspolicy</Link>
          <Link to="/villkor">Användarvillkor</Link>
        </nav>
      </div>
    </div>
  );
}
