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
import {
  ensureNotifyPermission,
  notificationPermission,
} from "../lib/notifications";
import type { PublicFishingSession } from "../lib/types";
import "./CompanyPanel.css";

const DEFAULT_HELLO = "Hej! Öppen för sällskap — fiskar du kvar?";

export function CompanyPanel() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState<PublicFishingSession[]>([]);
  const [requests, setRequests] = useState<CompanyRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState("Fiskare");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [notifyState, setNotifyState] = useState(() =>
    notificationPermission(),
  );

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

  const pendingOut = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === "pending" &&
          auth.user &&
          r.fromUserId === auth.user.id &&
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
  }, [activeChatId]);

  function openChat(chatId: string, name: string) {
    setActiveChatId(chatId);
    setActiveName(name);
    setMsg(null);
    setOpen(true);
  }

  async function ask(person: PublicFishingSession) {
    if (!auth.user) {
      setMsg("Logga in under Profil först");
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await sendCompanyRequest({
      toUserId: person.userId,
      sessionId: person.id,
      message: DEFAULT_HELLO,
    });
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    setMsg(`Förfrågan skickad till ${person.displayName}`);
    void refreshRequests();
  }

  async function respond(id: string, accept: boolean, name: string) {
    setBusy(true);
    setMsg(null);
    const res = await respondCompanyRequest(id, accept);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    if (accept && res.chatId) {
      openChat(res.chatId, name);
      setMsg(null);
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

  const badge = pendingIn.length + myChats.length;

  return (
    <aside
      className={`company-panel${open ? " open" : ""}`}
      aria-label="Sällskap"
    >
      {open && (
        <div className="company-body">
          {!auth.user ? (
            <p className="company-hint">
              <Link to="/profil#konto">Logga in</Link> för att skicka och ta emot
              sällskap.
            </p>
          ) : activeChatId ? (
            <div className="company-chat">
              <div className="company-chat-head">
                <button
                  type="button"
                  className="company-btn ghost"
                  onClick={() => setActiveChatId(null)}
                >
                  ← Tillbaka
                </button>
                <strong>{activeName}</strong>
              </div>
              <div className="company-chat-log" aria-live="polite">
                {messages.length === 0 && (
                  <p className="company-empty">Skriv första meddelandet.</p>
                )}
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
                  placeholder="Skriv…"
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
              {msg && <p className="company-status">{msg}</p>}
            </div>
          ) : (
            <>
              <p className="company-lead">Allt sällskap i samma ruta</p>

              {notifyState !== "granted" && notifyState !== "unsupported" && (
                <button
                  type="button"
                  className="company-btn ghost"
                  onClick={() => {
                    void ensureNotifyPermission().then((ok) => {
                      setNotifyState(notificationPermission());
                      setMsg(
                        ok
                          ? "Notiser på · chatt, sällskap och check-in"
                          : "Notiser nekades i webbläsaren",
                      );
                    });
                  }}
                >
                  Slå på chatt-notiser
                </button>
              )}
              {notifyState === "granted" && (
                <p className="company-status">Chatt-notiser är på</p>
              )}

              {pendingIn.length > 0 && (
                <section className="company-section">
                  <h3>Nya förfrågningar</h3>
                  <ul className="company-list">
                    {pendingIn.map((r) => {
                      const name = r.fromName || "Fiskare";
                      return (
                        <li key={r.id}>
                          <div className="company-row">
                            <strong>{name}</strong>
                          </div>
                          <p className="company-msg">{r.message}</p>
                          <div className="company-actions">
                            <button
                              type="button"
                              className="company-btn"
                              disabled={busy}
                              onClick={() => void respond(r.id, true, name)}
                            >
                              Acceptera & chatta
                            </button>
                            <button
                              type="button"
                              className="company-btn ghost"
                              disabled={busy}
                              onClick={() => void respond(r.id, false, name)}
                            >
                              Neka
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {myChats.length > 0 && (
                <section className="company-section">
                  <h3>Chattar</h3>
                  <ul className="company-list">
                    {myChats.map((r) => {
                      const name =
                        (r.fromUserId === auth.user!.id
                          ? r.toName
                          : r.fromName) || "Fiskare";
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            className="company-person"
                            onClick={() => openChat(r.chatId!, name)}
                          >
                            <strong>{name}</strong>
                            <span>Öppna chatt</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className="company-section">
                <h3>Öppna för sällskap</h3>
                <ul className="company-list">
                  {openPeople.length === 0 && (
                    <li className="company-empty">
                      Ingen just nu. Be dem bocka i “Öppen för fiskesällskap”.
                    </li>
                  )}
                  {openPeople.map((p) => {
                    const already = pendingOut.some(
                      (r) => r.toUserId === p.userId,
                    );
                    const chatting = myChats.find(
                      (r) =>
                        r.fromUserId === p.userId || r.toUserId === p.userId,
                    );
                    return (
                      <li key={p.id}>
                        <div className="company-row">
                          <strong>{p.displayName}</strong>
                          <span>
                            {p.zoneName || "Kanalen"}
                            {p.visibility === "ghost" ? " · dold" : ""}
                          </span>
                        </div>
                        {chatting?.chatId ? (
                          <button
                            type="button"
                            className="company-btn"
                            onClick={() =>
                              openChat(chatting.chatId!, p.displayName)
                            }
                          >
                            Öppna chatt
                          </button>
                        ) : already ? (
                          <p className="company-status">Väntar på svar…</p>
                        ) : (
                          <button
                            type="button"
                            className="company-btn"
                            disabled={busy}
                            onClick={() => void ask(p)}
                          >
                            Fråga om sällskap
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {msg && <p className="company-status">{msg}</p>}
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="company-toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (open) setActiveChatId(null);
        }}
      >
        Sällskap
        {badge > 0 && <span className="company-badge">{badge}</span>}
      </button>
    </aside>
  );
}
