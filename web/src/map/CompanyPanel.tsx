import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  deleteMyChat,
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

export type CompanyState = {
  badge: number;
  openPeopleCount: number;
  pendingInCount: number;
};

type Props = {
  /** True when the fisher is checked in (can be discovered). */
  checkedIn: boolean;
  /** Local preference / session flag from check-in. */
  openForCompany: boolean;
  onBadgeChange?: (state: CompanyState) => void;
};

/**
 * Sällskap lives inside the check-in sheet so it does not cover P / locate.
 * Flow: tick "Vill ha sällskap" → others see you → Fråga → Acceptera → chat.
 */
export function CompanySection({
  checkedIn,
  openForCompany,
  onBadgeChange,
}: Props) {
  const auth = useAuth();
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

  /** Everyone who ticked “vill ha sällskap” (including people you already chat with). */
  const openPeople = useMemo(
    () => others.filter((r) => r.openForCompany),
    [others],
  );

  const badge = pendingIn.length + myChats.length;

  useEffect(() => {
    onBadgeChange?.({
      badge,
      openPeopleCount: openPeople.length,
      pendingInCount: pendingIn.length,
    });
  }, [badge, openPeople.length, pendingIn.length, onBadgeChange]);

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

  async function removeChat(chatId: string, name: string) {
    if (
      !window.confirm(
        `Radera chatten med ${name}? Meddelandena försvinner för er båda.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg(null);
    const { error } = await deleteMyChat(chatId);
    setBusy(false);
    if (error) {
      setMsg(error);
      return;
    }
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
      setChatDraft("");
    }
    setMsg(`Chatten med ${name} är raderad`);
    void refreshRequests();
  }

  if (!auth.user) {
    return (
      <section className="company-section company-embed" aria-label="Sällskap">
        <h3>Sällskap</h3>
        <p className="company-hint">
          <Link to="/profil#konto">Logga in</Link> för att hitta någon att fiska
          med.
        </p>
      </section>
    );
  }

  if (activeChatId) {
    return (
      <section className="company-section company-embed company-chat" aria-label="Chatt">
        <div className="company-chat-head">
          <button
            type="button"
            className="company-btn ghost"
            onClick={() => setActiveChatId(null)}
          >
            ← Tillbaka
          </button>
          <strong>{activeName}</strong>
          <button
            type="button"
            className="company-btn danger company-chat-delete"
            disabled={busy}
            onClick={() => void removeChat(activeChatId, activeName)}
          >
            Radera
          </button>
        </div>
        <div className="company-chat-log" aria-live="polite">
          {messages.length === 0 && (
            <p className="company-empty">Skriv första meddelandet.</p>
          )}
          {messages.map((m) => (
            <p
              key={m.id}
              className={m.senderId === auth.user!.id ? "mine" : "theirs"}
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
      </section>
    );
  }

  return (
    <section className="company-section company-embed" aria-label="Sällskap">
      <h3>Sällskap</h3>
      <p className="company-how">
        Bocka i <strong>Vill ha sällskap</strong> ovan så syns du för andra.
        Här ser du vem som vill träffas — tryck <strong>Fråga</strong>, de
        accepterar, sen chattar ni.
      </p>

      {checkedIn && openForCompany && (
        <p className="company-status on">Du syns som öppen för sällskap</p>
      )}
      {checkedIn && !openForCompany && (
        <p className="company-hint">
          Du är ute men dold för sällskap — bocka i rutan ovan om du vill bli
          tillfrågad.
        </p>
      )}
      {!checkedIn && (
        <p className="company-hint">
          Checka in först. Sedan kan du synas som öppen för sällskap.
        </p>
      )}

      {notifyState !== "granted" && notifyState !== "unsupported" && (
        <button
          type="button"
          className="company-btn ghost"
          onClick={() => {
            void ensureNotifyPermission().then((ok) => {
              setNotifyState(notificationPermission());
              setMsg(
                ok
                  ? "Notiser på · chatt och sällskap"
                  : "Notiser nekades i webbläsaren",
              );
            });
          }}
        >
          Slå på chatt-notiser
        </button>
      )}

      {pendingIn.length > 0 && (
        <div className="company-block">
          <h4>Vill fiska med dig</h4>
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
        </div>
      )}

      <div className="company-block">
        <h4>
          Vill ha sällskap nu
          {openPeople.length > 0 ? ` · ${openPeople.length}` : ""}
        </h4>
        <ul className="company-list">
          {openPeople.length === 0 && (
            <li className="company-empty">
              Ingen annan har bockat i “vill ha sällskap” just nu. Du behöver
              inte chatta först — när någon gör det syns de här.
            </li>
          )}
          {openPeople.map((p) => {
            const already = pendingOut.some((r) => r.toUserId === p.userId);
            const chatting = myChats.find(
              (r) =>
                r.fromUserId === p.userId || r.toUserId === p.userId,
            );
            return (
              <li key={p.userId} className="company-open-card">
                <div className="company-row">
                  <strong>{p.displayName}</strong>
                  <span className="company-pill">Vill ha sällskap</span>
                </div>
                <p className="company-msg">
                  {p.zoneName || "Kanalen"}
                  {p.visibility === "ghost" ? " · dold på kartan" : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
                {chatting?.chatId ? (
                  <button
                    type="button"
                    className="company-btn"
                    onClick={() => openChat(chatting.chatId!, p.displayName)}
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
      </div>

      {myChats.length > 0 && (
        <div className="company-block">
          <h4>Era chattar</h4>
          <ul className="company-list">
            {myChats.map((r) => {
              const name =
                (r.fromUserId === auth.user!.id ? r.toName : r.fromName) ||
                "Fiskare";
              return (
                <li key={r.id} className="company-chat-row">
                  <button
                    type="button"
                    className="company-person"
                    onClick={() => openChat(r.chatId!, name)}
                  >
                    <strong>{name}</strong>
                    <span>Öppna chatt</span>
                  </button>
                  <button
                    type="button"
                    className="company-btn ghost danger"
                    disabled={busy}
                    aria-label={`Radera chatt med ${name}`}
                    onClick={() => void removeChat(r.chatId!, name)}
                  >
                    Radera
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {msg && <p className="company-status">{msg}</p>}
    </section>
  );
}
