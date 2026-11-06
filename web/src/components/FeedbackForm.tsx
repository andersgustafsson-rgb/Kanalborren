import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { submitFeedback, type FeedbackKind } from "../lib/feedback";

const KINDS: { id: FeedbackKind; label: string }[] = [
  { id: "bug", label: "Bugg" },
  { id: "idea", label: "Förbättring" },
  { id: "tip", label: "Tips" },
];

export function FeedbackForm() {
  const auth = useAuth();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.user) {
      setMsg("Logga in under Profil först");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await submitFeedback({
      kind,
      message,
      page: window.location.pathname + window.location.hash,
    });
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    setMessage("");
    setMsg("Tack! Skickat till admin.");
  }

  if (!auth.configured) {
    return (
      <section className="home-board">
        <header className="home-board-head">
          <h2>Tips & buggar</h2>
          <p>Molnet saknas — feedback går inte att spara.</p>
        </header>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className="home-board">
        <header className="home-board-head">
          <h2>Tips & buggar</h2>
          <p>
            <Link to="/#profil">Logga in</Link> för att skicka buggar, tips
            eller förbättringsförslag till admin.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className="home-board" aria-labelledby="feedback-title">
      <header className="home-board-head">
        <h2 id="feedback-title">Tips & buggar</h2>
        <p>Säg till om något strular eller kan bli bättre — admin läser det.</p>
      </header>
      <form className="catch-form" onSubmit={onSubmit}>
        <div className="period-tabs" role="group" aria-label="Typ">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={kind === k.id ? "period on" : "period"}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <label className="profile-field">
          Meddelande
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            required
            placeholder="T.ex. kartan hoppar när… / vore bra om…"
          />
        </label>
        <button type="submit" className="cta" disabled={busy}>
          {busy ? "Skickar…" : "Skicka till admin"}
        </button>
        {msg && <p className="catch-msg">{msg}</p>}
      </form>
    </section>
  );
}
