import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { submitFeedback, type FeedbackKind } from "../lib/feedback";
import "./FeedbackForm.css";

const KINDS: { id: FeedbackKind; label: string }[] = [
  { id: "bug", label: "Bugg" },
  { id: "idea", label: "Förbättring" },
  { id: "tip", label: "Tips" },
];

function IconTools() {
  return (
    <svg viewBox="0 0 40 40" className="ch-tools" aria-hidden>
      <path
        d="M12 28l10-10 3 3-10 10H12v-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M24 9l3 3M27 12l4-1 2 2-5 5-2-2 1-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 18c2-4 6-6 10-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBug() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="12" cy="13" rx="5" ry="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7V4M8 9 5.5 7M16 9l2.5-2M7 13H4m16 0h-3M8 17l-2.5 2M16 17l2.5 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M9 18h6M10 21h4M8 10a4 4 0 1 1 8 0c0 1.7-.9 2.8-2 3.7-.7.6-1.2 1.2-1.2 2.3h-1.6c0-1.1-.5-1.7-1.2-2.3-1.1-.9-2-2-2-3.7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTip() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M5 6.5h10.5a3 3 0 0 1 3 3V14a3 3 0 0 1-3 3H11l-4 3v-3H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 7.5 12 13l7.5-5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 12l15-7-5 15-2.5-6.5L4 12z" fill="currentColor" />
    </svg>
  );
}

function KindIcon({ id }: { id: FeedbackKind }) {
  if (id === "bug") return <IconBug />;
  if (id === "tip") return <IconTip />;
  return <IconBulb />;
}

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

  const head = (
    <header className="ch-head">
      <div className="ch-head-copy">
        <div className="ch-title-row">
          <IconTools />
          <h2 id="feedback-title">
            TIPS & <span>BUGGAR</span>
          </h2>
        </div>
        <p>Säg till om något strular eller kan bli bättre — admin läser det.</p>
      </div>
      <div className="ch-hero" aria-hidden>
        <img
          src="/challenge/challenge-hero-abborre.jpg"
          alt=""
          width={512}
          height={512}
        />
      </div>
    </header>
  );

  if (!auth.configured) {
    return (
      <section className="feedback-board" aria-labelledby="feedback-title">
        {head}
        <p className="ch-gate">Molnet saknas — feedback går inte att spara.</p>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className="feedback-board" aria-labelledby="feedback-title">
        {head}
        <p className="ch-gate">
          <Link to="/#profil">Logga in</Link> för att skicka buggar, tips eller
          förbättringsförslag till admin.
        </p>
      </section>
    );
  }

  return (
    <section className="feedback-board" aria-labelledby="feedback-title">
      {head}
      <form className="feedback-form" onSubmit={onSubmit}>
        <div className="feedback-kinds" role="group" aria-label="Typ">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={kind === k.id ? "feedback-kind on" : "feedback-kind"}
              onClick={() => setKind(k.id)}
            >
              <KindIcon id={k.id} />
              {k.label}
            </button>
          ))}
        </div>
        <label className="feedback-field">
          <span className="feedback-field-label">
            <IconMail /> Meddelande
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
            required
            placeholder="T.ex. kartan hoppar när… / vore bra om…"
          />
        </label>
        <button type="submit" className="feedback-send" disabled={busy}>
          {busy ? (
            "Skickar…"
          ) : (
            <>
              <IconSend /> Skicka till admin
            </>
          )}
        </button>
        {msg && <p className="feedback-msg">{msg}</p>}
      </form>
    </section>
  );
}
