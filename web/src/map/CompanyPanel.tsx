import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  listChatMessages,
  listMyCompanyRequests,
  respondCompanyRequest,
  sendChatMessage,
  sendCompanyRequest,
  subscribeCompanyInbox,
  type ChatMessage,
  type CompanyRequest,
} from "../lib/company";
import { subscribePublicSessions } from "../lib/fishingSessions";
import type { PublicFishingSession } from "../lib/types";
import "./CompanyPanel.css";

type Tab = "opna" | "inkorg" | "chatt";

export function CompanyPanel() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("opna");
  const [others, setOthers] = useState<PublicFishingSession[]>([]);
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draftByUser, setDraftByUser] = useState<Record<string, string>>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const refreshRequests = useCallback(async () => {
    if (!auth.user) {
      setRequests([]);
      return;
    }
    setRequests(await listMyCompanyRequests());
  }, [auth.user]);

  useEffect(() => {
    return subscribePublicSessions(setOthers, auth.user?.id);
  }, [auth.user?.id]);

  useEffect(() => {
    void refreshRequests();
    if (!auth.user) return;
    return subscribeCompanyInbox(auth.user.id, () => {
      void refreshRequests();
    });
  }, [auth.user, refreshRequests]);

  const openPeople = useMemo(
    () => others.filter((r) => r.openForCompany),
    [others],
  );

  const pendingIn = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === "pending" &&
          auth.user &&
          r.toUserId === auth.user.id &&
          Date.parse(r.expiresAt) > Date.now(),
      ),
    [requests, auth.user],
  );

  const myChats = useMemo(
    () => requests.filter((r) => r.status === "accepted" && r.chatId),
    [requests],
  );

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void listChatMessages(activeChatId).then((rows) => {
        if (!cancelled) setMessages(rows);
      });
    };
    load();
    const t = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [activeChatId, requests]);

  async function ask(person: PublicFishingSession) {
    if (!auth.user) {
      setMsg("Logga in under Profil först");
      return;
    }
    const text = (draftByUser[person.userId] || "").trim();
    if (!text) {
      setMsg("Skriv en kort hälsning först");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await sendCompanyRequest({
      toUserId: person.userId,
      sessionId: person.id,
      message: text,
    });
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    setDraftByUser((prev) => ({ ...prev, [person.userId]: "" }));
    setMsg("Förfrågan skickad");
    setTab("inkorg");
    void refreshRequests();
  }

  async function respond(id: string, accept: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await respondCompanyRequest(id, accept);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    if (accept && res.chatId) {
      setActiveChatId(res.chatId);
      setTab("chatt");
      setMsg("Accepterad · chatt öppen");
    } else {
      setMsg("Nekad");
    }
    void refreshRequests();
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChatId) return;
    setBusy(true);
    const { error } = await sendChatMessage(activeChatId, chatDraft);
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    setChatDraft("");
    setMessages(await listChatMessages(activeChatId));
  }

  const badge = pendingIn.length;

  return (
    <aside className={`company-panel${open ? " open" : ""}`} aria-label="Sällskap">
      <button
        type="button"
        className="company-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Sällskap
        {badge > 0 && <span className="company-badge">{badge}</span>}
      </button>

      {open && (
        <div className="company-body">
          {!auth.user ? (
            <p className="company-hint">
              <Link to="/profil#konto">Logga in</Link> för att skicka och ta emot
              fiskesällskap.
            </p>
          ) : (
            <>
              <div className="company-tabs" role="tablist">
                {(
                  [
                    ["opna", "Öppna"],
                    ["inkorg", `Inkorg${badge ? ` (${badge})` : ""}`],
                    ["chatt", "Chatt"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    className={tab === id ? "on" : ""}
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "opna" && (
                <ul className="company-list">
                  {openPeople.length === 0 && (
                    <li className="company-empty">
                      Ingen öppen för sällskap just nu. Checka in med toggle
                      “Öppen för fiskesällskap”.
                    </li>
                  )}
                  {openPeople.map((p) => (
                    <li key={p.id}>
                      <div className="company-row">
                        <strong>{p.displayName}</strong>
                        <span>{p.zoneName || "Kanalen"}</span>
                      </div>
                      <input
                        className="company-input"
                        maxLength={200}
                        placeholder="Hej, fiskar du kvar en stund?"
                        value={draftByUser[p.userId] || ""}
                        onChange={(e) =>
                          setDraftByUser((prev) => ({
                            ...prev,
                            [p.userId]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="company-btn"
                        disabled={busy}
                        onClick={() => void ask(p)}
                      >
                        Fråga om sällskap
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {tab === "inkorg" && (
                <ul className="company-list">
                  {requests.length === 0 && (
                    <li className="company-empty">Inga förfrågningar ännu.</li>
                  )}
                  {requests.map((r) => {
                    const incoming = r.toUserId === auth.user!.id;
                    const other = incoming ? r.fromName : r.toName;
                    return (
                      <li key={r.id}>
                        <div className="company-row">
                          <strong>
                            {incoming ? "Från" : "Till"} {other || "Fiskare"}
                          </strong>
                          <span>{r.status}</span>
                        </div>
                        <p className="company-msg">{r.message}</p>
                        {incoming && r.status === "pending" && (
                          <div className="company-actions">
                            <button
                              type="button"
                              className="company-btn"
                              disabled={busy}
                              onClick={() => void respond(r.id, true)}
                            >
                              Acceptera
                            </button>
                            <button
                              type="button"
                              className="company-btn ghost"
                              disabled={busy}
                              onClick={() => void respond(r.id, false)}
                            >
                              Neka
                            </button>
                          </div>
                        )}
                        {r.status === "accepted" && r.chatId && (
                          <button
                            type="button"
                            className="company-btn ghost"
                            onClick={() => {
                              setActiveChatId(r.chatId);
                              setTab("chatt");
                            }}
                          >
                            Öppna chatt
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {tab === "chatt" && (
                <div className="company-chat">
                  {myChats.length === 0 && (
                    <p className="company-empty">
                      Inga chattar ännu. Acceptera en förfrågan först.
                    </p>
                  )}
                  {myChats.length > 0 && (
                    <select
                      className="company-input"
                      value={activeChatId || ""}
                      onChange={(e) => setActiveChatId(e.target.value || null)}
                    >
                      <option value="">Välj chatt</option>
                      {myChats.map((r) => {
                        const other =
                          r.fromUserId === auth.user!.id
                            ? r.toName
                            : r.fromName;
                        return (
                          <option key={r.id} value={r.chatId || ""}>
                            {other || "Fiskare"}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  {activeChatId && (
                    <>
                      <div className="company-chat-log" aria-live="polite">
                        {messages.map((m) => (
                          <p
                            key={m.id}
                            className={
                              m.senderId === auth.user!.id ? "mine" : "theirs"
                            }
                          >
                            {m.body}
                          </p>
                        ))}
                      </div>
                      <form className="company-chat-form" onSubmit={sendChat}>
                        <input
                          className="company-input"
                          value={chatDraft}
                          maxLength={1000}
                          placeholder="Skriv meddelande…"
                          onChange={(e) => setChatDraft(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="company-btn"
                          disabled={busy || !chatDraft.trim()}
                        >
                          Skicka
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}

              {msg && <p className="company-status">{msg}</p>}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
