import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  deleteAdminCatch,
  deleteAdminUser,
  endAdminSession,
  fetchAdminCatches,
  fetchAdminRequests,
  fetchAdminSessions,
  fetchAdminStats,
  fetchAdminUsers,
  setUserBanned,
  type AdminCatch,
  type AdminRequest,
  type AdminSession,
  type AdminStats,
  type AdminUser,
} from "../lib/adminApi";
import {
  deleteFeedback,
  fetchAdminFeedback,
  setFeedbackStatus,
  type FeedbackRow,
} from "../lib/feedback";
import "./AdminPage.css";

const KIND_LABEL: Record<string, string> = {
  tip: "Tips",
  bug: "Bugg",
  idea: "Förbättring",
};

type UserFilter = "all" | "active" | "banned";

type SectionId = "feedback" | "users" | "sessions" | "catches" | "requests";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("sv-SE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtDay(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("sv-SE", { dateStyle: "short" });
  } catch {
    return iso;
  }
}

function AdminSection({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  count?: number;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
}) {
  return (
    <section className={`admin-card${open ? " open" : ""}`}>
      <button
        type="button"
        className="admin-card-toggle"
        aria-expanded={open}
        onClick={() => onToggle(id)}
      >
        <span>
          {title}
          {typeof count === "number" ? (
            <em className="admin-count">{count}</em>
          ) : null}
        </span>
        <span className="admin-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? <div className="admin-card-body">{children}</div> : null}
    </section>
  );
}

export function AdminPage() {
  const auth = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [catches, setCatches] = useState<AdminCatch[]>([]);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [showEndedSessions, setShowEndedSessions] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    feedback: true,
    users: true,
    sessions: false,
    catches: false,
    requests: false,
  });

  const reload = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [s, u, sess, c, r, f] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminSessions(),
        fetchAdminCatches(),
        fetchAdminRequests(),
        fetchAdminFeedback(),
      ]);
      setStats(s);
      setUsers(u);
      setSessions(sess);
      setCatches(c);
      setRequests(r);
      setFeedback(f);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kunde inte ladda admin");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (auth.ready && auth.isAdmin) void reload();
  }, [auth.ready, auth.isAdmin, reload]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users
      .filter((u) => {
        if (userFilter === "active" && !u.activeNow) return false;
        if (userFilter === "banned" && !u.bannedAt) return false;
        if (!q) return true;
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.activeNow !== b.activeNow) return a.activeNow ? -1 : 1;
        if (Boolean(a.bannedAt) !== Boolean(b.bannedAt)) {
          return a.bannedAt ? -1 : 1;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [users, userQuery, userFilter]);

  const activeSessions = useMemo(
    () => sessions.filter((s) => !s.endedAt),
    [sessions],
  );
  const visibleSessions = showEndedSessions ? sessions : activeSessions;
  const newFeedback = useMemo(
    () => feedback.filter((f) => f.status === "new").length,
    [feedback],
  );

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!auth.ready) {
    return (
      <div className="admin-page">
        <p className="admin-muted">Laddar…</p>
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/profil#konto" replace />;
  }

  if (!auth.isAdmin) {
    return (
      <div className="admin-page">
        <div className="admin-stack">
          <h1>Admin</h1>
          <p className="admin-muted">
            Du är inloggad men har inte admin-rättigheter.
          </p>
          <Link to="/">← Hem</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-stack">
        <header className="admin-top">
          <div>
            <p className="admin-eyebrow">KanalHugget</p>
            <h1>Admin</h1>
            <p className="admin-muted">{auth.user.email}</p>
          </div>
          <div className="admin-top-actions">
            <button
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void reload()}
            >
              Uppdatera
            </button>
            <Link className="chip" to="/">
              Hem
            </Link>
            <Link className="chip" to="/karta">
              Karta
            </Link>
          </div>
        </header>

        {msg && <p className="admin-error">{msg}</p>}

        <section className="admin-stats" aria-label="Översikt">
          <article>
            <strong>{stats?.users ?? "–"}</strong>
            <span>Användare</span>
          </article>
          <article>
            <strong>{stats?.activeSessions ?? "–"}</strong>
            <span>Aktiva nu</span>
          </article>
          <article>
            <strong>{stats?.catches ?? "–"}</strong>
            <span>Fångster</span>
          </article>
          <article>
            <strong>{stats?.pendingRequests ?? "–"}</strong>
            <span>Sällskap väntar</span>
          </article>
          <article>
            <strong>{stats?.openChats ?? "–"}</strong>
            <span>Chattar</span>
          </article>
          <article>
            <strong>{newFeedback || "–"}</strong>
            <span>Nya tips</span>
          </article>
        </section>

        <AdminSection
          id="feedback"
          title="Tips & buggar"
          count={feedback.length}
          open={openSections.feedback}
          onToggle={toggleSection}
        >
          <div className="admin-table-wrap admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Typ</th>
                  <th>Från</th>
                  <th>Meddelande</th>
                  <th>När</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {feedback.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-muted">
                      Inga tips ännu
                    </td>
                  </tr>
                )}
                {feedback.map((f) => (
                  <tr
                    key={f.id}
                    className={f.status !== "new" ? "dim" : undefined}
                  >
                    <td>
                      {KIND_LABEL[f.kind] || f.kind}
                      {f.status !== "new" ? ` · ${f.status}` : ""}
                    </td>
                    <td>{f.displayName}</td>
                    <td>
                      {f.message}
                      {f.page ? (
                        <>
                          <br />
                          <span className="admin-muted">{f.page}</span>
                        </>
                      ) : null}
                    </td>
                    <td>{fmt(f.createdAt)}</td>
                    <td>
                      <div className="admin-row-actions">
                        {f.status === "new" && (
                          <button
                            type="button"
                            className="chip"
                            disabled={busy}
                            onClick={() => {
                              void setFeedbackStatus(f.id, "done").then(
                                (err) => {
                                  if (err) setMsg(err);
                                  else void reload();
                                },
                              );
                            }}
                          >
                            Klar
                          </button>
                        )}
                        <button
                          type="button"
                          className="chip danger"
                          disabled={busy}
                          onClick={() => {
                            void deleteFeedback(f.id).then((err) => {
                              if (err) setMsg(err);
                              else void reload();
                            });
                          }}
                        >
                          Ta bort
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>

        <AdminSection
          id="users"
          title="Användare"
          count={users.length}
          open={openSections.users}
          onToggle={toggleSection}
        >
          <div className="admin-toolbar">
            <input
              className="admin-search"
              type="search"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Sök namn eller e-post"
              aria-label="Sök användare"
            />
            <div className="admin-filters" role="group" aria-label="Filter">
              {(
                [
                  ["all", "Alla"],
                  ["active", "Ute nu"],
                  ["banned", "Bannade"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={userFilter === id ? "chip on" : "chip"}
                  onClick={() => setUserFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="admin-muted admin-result-count">
            Visar {filteredUsers.length} av {users.length}
          </p>
          <div className="admin-table-wrap admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Användare</th>
                  <th>Status</th>
                  <th>Skapad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="admin-muted">
                      Inga träffar
                    </td>
                  </tr>
                )}
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={u.bannedAt ? "dim" : undefined}>
                    <td>
                      <strong>{u.displayName}</strong>
                      {u.isAdmin ? " · admin" : ""}
                      {u.activeNow ? " · ute nu" : ""}
                      {u.email ? (
                        <>
                          <br />
                          <span className="admin-muted">{u.email}</span>
                        </>
                      ) : null}
                    </td>
                    <td>{u.bannedAt ? "Bannad" : "OK"}</td>
                    <td>{fmtDay(u.createdAt)}</td>
                    <td>
                      {!u.isAdmin && (
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="chip"
                            disabled={busy}
                            onClick={() => {
                              void setUserBanned(u.id, !u.bannedAt).then(
                                (err) => {
                                  if (err) setMsg(err);
                                  else void reload();
                                },
                              );
                            }}
                          >
                            {u.bannedAt ? "Avbanna" : "Banna"}
                          </button>
                          <button
                            type="button"
                            className="chip danger"
                            disabled={busy}
                            onClick={() => {
                              const ok = window.confirm(
                                `Radera ${u.displayName} (${u.email || "utan e-post"}) permanent?\n\nKonto, fångster, chattar och sessioner tas bort.`,
                              );
                              if (!ok) return;
                              void deleteAdminUser(u.id).then((err) => {
                                if (err) setMsg(err);
                                else void reload();
                              });
                            }}
                          >
                            Radera
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>

        <AdminSection
          id="sessions"
          title="Sessioner"
          count={activeSessions.length}
          open={openSections.sessions}
          onToggle={toggleSection}
        >
          <label className="admin-check">
            <input
              type="checkbox"
              checked={showEndedSessions}
              onChange={(e) => setShowEndedSessions(e.target.checked)}
            />
            Visa avslutade
          </label>
          <div className="admin-table-wrap admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fiskare</th>
                  <th>Zon</th>
                  <th>Läge</th>
                  <th>Utgår</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleSessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-muted">
                      Inga sessioner
                    </td>
                  </tr>
                )}
                {visibleSessions.map((s) => (
                  <tr key={s.id} className={s.endedAt ? "dim" : undefined}>
                    <td>{s.displayName}</td>
                    <td>
                      {s.zoneName || "–"}
                      {s.openForCompany ? " · sällskap" : ""}
                    </td>
                    <td>{s.visibility}</td>
                    <td>
                      {s.endedAt
                        ? `Avslutad ${fmt(s.endedAt)}`
                        : fmt(s.expiresAt)}
                    </td>
                    <td>
                      {!s.endedAt && (
                        <button
                          type="button"
                          className="chip"
                          disabled={busy}
                          onClick={() => {
                            void endAdminSession(s.id).then((err) => {
                              if (err) setMsg(err);
                              else void reload();
                            });
                          }}
                        >
                          Avsluta
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>

        <AdminSection
          id="catches"
          title="Fångster"
          count={catches.length}
          open={openSections.catches}
          onToggle={toggleSection}
        >
          <div className="admin-table-wrap admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fiskare</th>
                  <th>Art</th>
                  <th>Mått</th>
                  <th>När</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {catches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="admin-muted">
                      Inga fångster
                    </td>
                  </tr>
                )}
                {catches.map((c) => (
                  <tr key={c.id}>
                    <td>{c.displayName}</td>
                    <td>
                      {c.species}
                      {c.zoneName ? ` · ${c.zoneName}` : ""}
                    </td>
                    <td>
                      {c.lengthCm != null ? `${c.lengthCm} cm` : ""}
                      {c.lengthCm != null && c.weightKg != null ? " · " : ""}
                      {c.weightKg != null ? `${c.weightKg} kg` : ""}
                    </td>
                    <td>{fmt(c.caughtAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="chip"
                        disabled={busy}
                        onClick={() => {
                          void deleteAdminCatch(c.id).then((err) => {
                            if (err) setMsg(err);
                            else void reload();
                          });
                        }}
                      >
                        Ta bort
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>

        <AdminSection
          id="requests"
          title="Sällskapsförfrågningar"
          count={requests.length}
          open={openSections.requests}
          onToggle={toggleSection}
        >
          <div className="admin-table-wrap admin-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Från → Till</th>
                  <th>Meddelande</th>
                  <th>Status</th>
                  <th>När</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={4} className="admin-muted">
                      Inga förfrågningar
                    </td>
                  </tr>
                )}
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.fromName} → {r.toName}
                    </td>
                    <td>{r.message}</td>
                    <td>{r.status}</td>
                    <td>{fmt(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      </div>
    </div>
  );
}
