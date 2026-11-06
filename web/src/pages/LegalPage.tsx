import { Link, useLocation } from "react-router-dom";
import "./HelpPage.css";

const CONTACT_EMAIL = "agracing2@hotmail.com";
const UPDATED = "2026-11-06";

const PRIVACY = {
  title: "Integritetspolicy",
  intro:
    "Här beskriver vi hur KanalHugget behandlar personuppgifter. Kortversion: du styr vad som syns, och vi säljer inget.",
  sections: [
    {
      h: "Personuppgiftsansvarig",
      p: [
        `KanalHugget · kontakt: ${CONTACT_EMAIL}`,
        "Beta-tjänst för sportfiske kring Malmö kanal.",
      ],
    },
    {
      h: "Vilka uppgifter vi behandlar",
      p: [
        "E-post och lösenord — konto och inloggning.",
        "Visningsnamn och avatar — syns för andra när du är aktiv.",
        "Åldersintyg (16+) — för att tjänsten inte ska riktas till yngre.",
        "Zon eller frivillig ungefärlig position — när du checkar in på kartan.",
        "Chatt och sällskapsförfrågningar — efter att ni accepterat varandra.",
        "Fångstrapporter och utmaningar — community / topplista.",
        "Tekniska loggar (t.ex. IP via leverantör) — drift och missbruksskydd.",
      ],
    },
    {
      h: "Synlighet du styr",
      p: [
        "Ghost — ingen kartmarkering.",
        "Zon (standard) — bara namngiven zon, inte exakt kajmeter.",
        "Exakt punkt — valfritt, mer detaljerad.",
        "Öppen för fiskesällskap — separat val (av som standard).",
        "Du kan alltid dölja dig / checka ut. Sessioner går ut automatiskt.",
      ],
    },
    {
      h: "Delning och lagring",
      p: [
        "Vi säljer inte personuppgifter.",
        "Data lagras hos hosting-/databasleverantör (t.ex. Render, Supabase) med skyddsåtgärder.",
        "Andra användare ser bara det du gjort synligt.",
        "Du kan begära rättelse eller radering via kontaktmejlen. Du kan också klaga till IMY.",
      ],
    },
    {
      h: "Minderåriga",
      p: ["Tjänsten är avsedd för personer 16 år eller äldre."],
    },
  ],
};

const TERMS = {
  title: "Användarvillkor",
  intro:
    "Genom att skapa konto eller använda KanalHugget godkänner du villkoren nedan.",
  sections: [
    {
      h: "Tjänsten",
      p: [
        "KanalHugget är en lokal community-app för sportfiske kring Malmö kanal.",
        "Regler, vattenstånd och tips är hjälpmedel — inte juridisk rådgivning eller garanti.",
      ],
    },
    {
      h: "Ålder och konto",
      p: [
        "Du måste vara minst 16 år.",
        "Du ansvarar för ditt konto. Ett konto per person.",
      ],
    },
    {
      h: "Uppförande",
      p: [
        "Ingen trakasseri, spam, hot, vilseledande möten eller delning av andras privata uppgifter.",
        "Vi kan varna, begränsa eller stänga av konton.",
      ],
    },
    {
      h: "Plats, fångster och fiske",
      p: [
        "Du styr Ghost / Zon / exakt punkt och om du är öppen för sällskap.",
        "Fångstrapporter och annan användardata kan vara felaktig eller inaktuell.",
        "Du ansvarar själv för att följa lag och lokala regler. Appen ersätter inte det.",
      ],
    },
    {
      h: "Ansvar och kontakt",
      p: [
        "Tjänsten tillhandahålls i befintligt skick, i den mån lag tillåter.",
        `Kontakt: ${CONTACT_EMAIL}`,
      ],
    },
  ],
};

export function LegalPage() {
  const { pathname } = useLocation();
  const isPrivacy = pathname.startsWith("/integritet");
  const content = isPrivacy ? PRIVACY : TERMS;

  return (
    <div className="help-page">
      <div className="help-stack">
        <nav className="help-nav">
          <Link to="/">← Hem</Link>
          <Link to="/hjalp">Hjälp</Link>
          <Link to={isPrivacy ? "/villkor" : "/integritet"}>
            {isPrivacy ? "Villkor" : "Integritet"}
          </Link>
        </nav>

        <header className="help-hero">
          <p className="help-eyebrow">KanalHugget · uppdaterad {UPDATED}</p>
          <h1>{content.title}</h1>
          <p>{content.intro}</p>
        </header>

        {content.sections.map((s) => (
          <section key={s.h} className="help-card">
            <h2>{s.h}</h2>
            <ol>
              {s.p.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
        ))}

        <p className="profile-muted" style={{ margin: 0, color: "#9bb0a4" }}>
          Detta är en tydlig beta-policy, inte juridisk granskning. Frågor:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
