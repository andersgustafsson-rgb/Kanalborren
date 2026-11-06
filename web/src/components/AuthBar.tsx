import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { loadProfile } from "../lib/profileStorage";

export function AuthBar() {
  const auth = useAuth();
  const profile = loadProfile();
  const cloud = isSupabaseConfigured();
  const loggedIn = Boolean(auth.user);

  return (
    <div className="auth-bar auth-bar-profile">
      <Link className="auth-profile-link" to="/profil">
        <img src={profile.avatarSrc} alt="" />
        <span>
          <strong>{auth.displayName || profile.displayName}</strong>
          <small>
            {loggedIn
              ? `Inloggad · ${auth.user?.email ?? ""}`
              : profile.bio
                ? profile.bio.slice(0, 48) + (profile.bio.length > 48 ? "…" : "")
                : "Profil i telefonen · logga in för topplistan"}
          </small>
        </span>
      </Link>
      {!cloud && (
        <p className="auth-hint">
          Molnet är inte inkopplat (saknas nycklar i bygget). Profilen här är
          bara lokal.
        </p>
      )}
      {cloud && !loggedIn && (
        <Link className="chip on" to="/profil#konto">
          Logga in / skapa konto
        </Link>
      )}
      {cloud && loggedIn && (
        <p className="auth-hint">Inloggad · redo för live-karta</p>
      )}
      {loggedIn && (
        <button
          type="button"
          className="chip"
          onClick={() => void auth.signOut()}
        >
          Logga ut
        </button>
      )}
    </div>
  );
}
