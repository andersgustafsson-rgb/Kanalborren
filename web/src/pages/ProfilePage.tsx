import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AVATARS, type PresetAvatarId } from "../map/avatars";
import { useAuth } from "../lib/AuthContext";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  loadProfile,
  saveBio,
  saveCity,
  saveDisplayName,
  saveFishingStyle,
  saveProfileAvatarFile,
  saveProfileAvatarPreset,
} from "../lib/profileStorage";
import { resolveAvatarSrc, type AvatarChoice } from "../map/avatarStorage";
import "./ProfilePage.css";

export function ProfilePage() {
  const auth = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = loadProfile();

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [city, setCity] = useState(initial.city);
  const [fishingStyle, setFishingStyle] = useState(initial.fishingStyle);
  const [avatar, setAvatar] = useState<AvatarChoice>(initial.avatar);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const avatarSrc = resolveAvatarSrc(avatar);

  function persistName(value: string) {
    setDisplayName(value);
    saveDisplayName(value);
    auth.setDisplayName(value);
    flashSaved();
  }

  function flashSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  function pickPreset(id: PresetAvatarId) {
    saveProfileAvatarPreset(id);
    setAvatar((prev) => ({ ...prev, id }));
    setUploadError(null);
    flashSaved();
  }

  async function onUpload(file: File) {
    try {
      const dataUrl = await saveProfileAvatarFile(file);
      setAvatar({ id: "custom", customSrc: dataUrl });
      setUploadError(null);
      flashSaved();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Uppladdning misslyckades");
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMsg(null);
    auth.setDisplayName(displayName);
    if (authMode === "signup") {
      const res = await auth.signUp(email, password);
      setAuthBusy(false);
      if (res.error) setAuthMsg(res.error);
      else if (res.needsEmailConfirm)
        setAuthMsg(
          "Konto skapat · kolla mejlen och bekräfta, sedan kan du logga in.",
        );
      else setAuthMsg("Konto skapat · du är inloggad");
      return;
    }
    const { error } = await auth.signIn(email, password);
    setAuthBusy(false);
    if (!error) {
      setAuthMsg("Inloggad");
      return;
    }
    const soft =
      /invalid login credentials/i.test(error)
        ? "Fel e-post/lösenord, eller kontot är inte bekräftat. I Supabase → Authentication → Users: radera användaren, skapa konto igen här."
        : error;
    setAuthMsg(soft);
  }

  return (
    <div className="profile-page">
      <img
        className="profile-bg"
        src="/brand/malmo-kanal-hero.jpg"
        alt=""
        decoding="async"
      />
      <div className="profile-scrim" aria-hidden />

      <div className="profile-stack">
        <nav className="profile-nav">
          <Link to="/">← Hem</Link>
          <Link to="/karta">Karta</Link>
        </nav>

        <header className="profile-hero">
          <button
            type="button"
            className="profile-photo"
            onClick={() => fileRef.current?.click()}
            title="Byt profilbild"
          >
            <img src={avatarSrc} alt="" />
            <span>Byt bild</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
              e.target.value = "";
            }}
          />
          <div className="profile-hero-text">
            <h1>Min profil</h1>
            <p>Namn, bild och kort intro — syns när du checkar in.</p>
            <p className="profile-tab-hint">
              Demo: namnet gäller bara den här fliken (så Spliffan och Bosse
              kan vara olika).
            </p>
            {saved && <p className="profile-saved">Sparat</p>}
          </div>
        </header>

        {uploadError && <p className="profile-error">{uploadError}</p>}

        <section className="profile-card">
          <label className="profile-field">
            Visningsnamn
            <input
              value={displayName}
              maxLength={32}
              onChange={(e) => persistName(e.target.value)}
              placeholder="t.ex. KanalKungen"
            />
          </label>

          <label className="profile-field">
            Stad / område
            <input
              value={city}
              maxLength={60}
              onChange={(e) => {
                setCity(e.target.value);
                saveCity(e.target.value);
                flashSaved();
              }}
              placeholder="Malmö"
            />
          </label>

          <label className="profile-field">
            Fiskestil
            <input
              value={fishingStyle}
              maxLength={80}
              onChange={(e) => {
                setFishingStyle(e.target.value);
                saveFishingStyle(e.target.value);
                flashSaved();
              }}
              placeholder="t.ex. jigg, ul, fluga"
            />
          </label>

          <label className="profile-field">
            Om dig
            <textarea
              value={bio}
              maxLength={280}
              rows={4}
              onChange={(e) => {
                setBio(e.target.value);
                saveBio(e.target.value);
                flashSaved();
              }}
              placeholder="Kort intro till andra vid kanalen…"
            />
            <small>{bio.length}/280</small>
          </label>
        </section>

        <section className="profile-card">
          <h2>Avatar</h2>
          <p className="profile-muted">Välj en färdig gubbe eller ladda upp egen bild ovan.</p>
          <div className="profile-avatars">
            {AVATARS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={avatar.id === a.id ? "avatar-opt on" : "avatar-opt"}
                title={a.label}
                aria-pressed={avatar.id === a.id}
                onClick={() => pickPreset(a.id)}
              >
                <img src={a.src} alt={a.label} />
              </button>
            ))}
          </div>
        </section>

        <section className="profile-card">
          <h2>Konto</h2>
          {!isSupabaseConfigured() ? (
            <p className="profile-muted">
              Lokal profil sparas i webbläsaren.
            </p>
          ) : auth.user ? (
            <div className="profile-account-row">
              <p className="profile-muted">Inloggad · {auth.user.email}</p>
              <button
                type="button"
                className="chip"
                onClick={() => void auth.signOut()}
              >
                Logga ut
              </button>
            </div>
          ) : (
            <form className="profile-auth" onSubmit={submitAuth}>
              <div className="period-tabs auth-tabs">
                <button
                  type="button"
                  className={authMode === "login" ? "period on" : "period"}
                  onClick={() => setAuthMode("login")}
                >
                  Logga in
                </button>
                <button
                  type="button"
                  className={authMode === "signup" ? "period on" : "period"}
                  onClick={() => setAuthMode("signup")}
                >
                  Skapa konto
                </button>
              </div>
              <label className="profile-field">
                E-post
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="du@exempel.se"
                  autoComplete="email"
                />
              </label>
              <label className="profile-field">
                Lösenord
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minst 6 tecken"
                  autoComplete={
                    authMode === "signup" ? "new-password" : "current-password"
                  }
                />
              </label>
              <button type="submit" className="cta" disabled={authBusy}>
                {authBusy
                  ? "Vänta…"
                  : authMode === "signup"
                    ? "Skapa konto"
                    : "Logga in"}
              </button>
              {authMsg && <p className="profile-muted">{authMsg}</p>}
              <p className="profile-muted">
                Du stannar inloggad i webbläsaren — som i fantasy-appar.
              </p>
            </form>
          )}
        </section>

        <Link className="cta profile-map-cta" to="/karta">
          Till kartan
        </Link>
      </div>
    </div>
  );
}
