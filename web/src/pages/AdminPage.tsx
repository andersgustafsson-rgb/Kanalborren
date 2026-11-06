import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import {
  deleteAdminCatch,
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
import "./AdminPage.css";

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

export function AdminPage() {
  const auth = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [catches, setCatches] = useState<AdminCatch[]>([]);
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const [s, u, sess, c, r] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminSessions(),
        fetchAdminCatches(),
        fetchAdminRequests(),
      ]);
      setStats(s);
      setUsers(u);
      setSessions(sess);
      setCatches(c);
      setRequests(r);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Kunde inte ladda admin");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (auth.ready && auth.isAdmin) void reload();
  }, [auth.ready, auth.isAdmin, reload]);

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
        </section>

        <section className="admin-card">
          <h2>Användare</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>E-post</th>
                  <th>Status</th>
                  <th>Skapad</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      {u.displayName}
                      {u.isAdmin ? " · admin" : ""}
                      {u.activeNow ? " · ute nu" : ""}
                    </td>
                    <td>{u.email}</td>
                    <td>{u.bannedAt ? "Bannad" : "OK"}</td>
                    <td>{fmt(u.createdAt)}</td>
                    <td>
                      {!u.isAdmin && (
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-card">
          <h2>Sessioner</h2>
          <div className="admin-table-wrap">
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
                {sessions.map((s) => (
                  <tr key={s.id} className={s.endedAt ? "dim" : undefined}>
                    <td>{s.displayName}</td>
                    <td>
                      {s.zoneName || "–"}
                      {s.openForCompany ? " · sällskap" : ""}
                    </td>
                    <td>{s.visibility}</td>
                    <td>{s.endedAt ? `Avslutad ${fmt(s.endedAt)}` : fmt(s.expiresAt)}</td>
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
        </section>

        <section className="admin-card">
          <h2>Fångster</h2>
          <div className="admin-table-wrap">
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
        </section>

        <section className="admin-card">
          <h2>Sällskapsförfrågningar</h2>
          <div className="admin-table-wrap">
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
        </section>
      </div>
    </div>
  );
}
