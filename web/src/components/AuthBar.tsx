import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { loadProfile } from "../lib/profileStorage";

export function AuthBar() {
  const auth = useAuth();
  const profile = loadProfile();

  return (
    <div className="auth-bar auth-bar-profile">
      <Link className="auth-profile-link" to="/profil">
        <img src={profile.avatarSrc} alt="" />
        <span>
          <strong>{auth.displayName || profile.displayName}</strong>
          <small>
            {profile.bio
              ? profile.bio.slice(0, 48) + (profile.bio.length > 48 ? "…" : "")
              : "Redigera profil · bild · intro"}
          </small>
        </span>
      </Link>
      {!isSupabaseConfigured() && (
        <p className="auth-hint">
          Lokal demo · två flikar kan se varandra. Supabase senare för riktig
          sync.
        </p>
      )}
      {isSupabaseConfigured() && !auth.user && (
        <Link className="chip on" to="/profil">
          Logga in / skapa konto
        </Link>
      )}
      {isSupabaseConfigured() && auth.user && (
        <p className="auth-hint">Inloggad · redo för live-karta</p>
      )}
      {auth.user && (
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
