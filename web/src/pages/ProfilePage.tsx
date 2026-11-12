import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  saveSpeciesPbs,
  type SpeciesPbMap,
} from "../lib/profileStorage";
import { SPECIES } from "../lib/species";
import { resolveAvatarSrc, type AvatarChoice } from "../map/avatarStorage";
import { MyCatchDashboard } from "../components/MyCatchDashboard";
import "./ProfilePage.css";

type ProfileTab = "om" | "fangster" | "rekord" | "konto";

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "om", label: "Om mig" },
  { id: "fangster", label: "Fångster" },
  { id: "rekord", label: "Rekord" },
  { id: "konto", label: "Konto" },
];

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 19c1.8-3.2 4.2-4.8 7-4.8S17.2 15.8 19 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11" r="2.2" fill="currentColor" />
    </svg>
  );
}

function IconHook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3v10a4 4 0 1 0 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="3.8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 3.5V8h4.5M8 12h8M8 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 7.5 12 13l7.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 8.5h3l1.4-2h7.2l1.4 2H20a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18v-8A1.5 1.5 0 0 1 4 8.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="13.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function profileTabFromHash(hash: string): ProfileTab | null {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "konto") return "konto";
  if (h === "rekord" || h === "pb") return "rekord";
  if (h === "fangster" || h === "fangst") return "fangster";
  if (h === "om") return "om";
  return null;
}

export function ProfileStudio() {
  const auth = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = loadProfile();

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [city, setCity] = useState(initial.city);
  const [fishingStyle, setFishingStyle] = useState(initial.fishingStyle);
  const [speciesPbs, setSpeciesPbs] = useState<SpeciesPbMap>(
    () => initial.speciesPbs,
  );
  const [avatar, setAvatar] = useState<AvatarChoice>(initial.avatar);
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const location = useLocation();
  const [section, setSection] = useState<ProfileTab>(
    () => profileTabFromHash(location.hash) || "om",
  );

  useEffect(() => {
    const next = profileTabFromHash(location.hash);
    if (next) setSection(next);
  }, [location.hash]);

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
      const res = await auth.signUp(email, password, {
        ageAttested: ageOk,
        acceptedTerms: termsOk,
      });
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
    <div className="profile-studio">
        <header className="profile-hero">
          <button
            type="button"
            className="profile-photo"
            onClick={() => fileRef.current?.click()}
            title="Byt profilbild"
          >
            <img src={avatarSrc} alt="" />
            <span>
              <IconCamera /> Byt bild
            </span>
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
            <h1>{displayName || "Min profil"}</h1>
            <p className="profile-hero-mail">
              {auth.user?.email ? (
                <>
                  <IconMail /> {auth.user.email}
                </>
              ) : (
                city || "Lokal profil i den här webbläsaren"
              )}
            </p>
            {saved && <p className="profile-saved">Sparat</p>}
          </div>
        </header>

        {uploadError && <p className="profile-error">{uploadError}</p>}

        <nav className="profile-subtabs" role="tablist" aria-label="Profil">
          {PROFILE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={section === t.id}
              className={section === t.id ? "profile-subtab on" : "profile-subtab"}
              onClick={() => setSection(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {section === "om" && (
        <section className="profile-card">
          <label className="profile-field">
            <span className="profile-field-label">
              <IconUser /> Visningsnamn
            </span>
            <input
              value={displayName}
              maxLength={32}
              onChange={(e) => persistName(e.target.value)}
              placeholder="t.ex. KanalKungen"
            />
          </label>

          <label className="profile-field">
            <span className="profile-field-label">
              <IconPin /> Stad / område
            </span>
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
            <span className="profile-field-label">
              <IconHook /> Fiskestil
            </span>
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
            <span className="profile-field-label">
              <IconDoc /> Om dig
            </span>
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

          <div className="profile-avatar-block">
            <p className="profile-muted profile-avatar-title">
              Avatar som syns vid check-in
            </p>
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
          </div>
        </section>
        )}

        {section === "fangster" && <MyCatchDashboard />}

        {section === "rekord" && (
        <section className="profile-card" aria-labelledby="profile-pb-title">
          <h2 id="profile-pb-title">Personbästa</h2>
          <p className="profile-muted">
            Ange längd (cm) och/eller vikt (kg) per art. Tomt fält = valfritt;
            då används största värdet du loggat i appen. Nytt rekord låser upp
            PB-delningsbilden.
          </p>
          <div className="profile-pb-list">
            {SPECIES.map((s) => {
              const entry = speciesPbs[s.id];
              return (
                <div key={s.id} className="profile-pb-row">
                  <strong>{s.id}</strong>
                  <label className="profile-field profile-pb-field">
                    Längd
                    <input
                      inputMode="decimal"
                      placeholder="cm"
                      value={
                        entry?.lengthCm != null ? String(entry.lengthCm) : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim().replace(",", ".");
                        const next: SpeciesPbMap = { ...speciesPbs };
                        const cur = { ...(next[s.id] || {}) };
                        if (!raw) delete cur.lengthCm;
                        else {
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          cur.lengthCm = n;
                        }
                        if (cur.lengthCm == null && cur.weightKg == null) {
                          delete next[s.id];
                        } else next[s.id] = cur;
                        setSpeciesPbs(next);
                        saveSpeciesPbs(next);
                        flashSaved();
                      }}
                    />
                  </label>
                  <label className="profile-field profile-pb-field">
                    Vikt
                    <input
                      inputMode="decimal"
                      placeholder="kg"
                      value={
                        entry?.weightKg != null ? String(entry.weightKg) : ""
                      }
                      onChange={(e) => {
                        const raw = e.target.value.trim().replace(",", ".");
                        const next: SpeciesPbMap = { ...speciesPbs };
                        const cur = { ...(next[s.id] || {}) };
                        if (!raw) delete cur.weightKg;
                        else {
                          const n = Number(raw);
                          if (!Number.isFinite(n)) return;
                          cur.weightKg = n;
                        }
                        if (cur.lengthCm == null && cur.weightKg == null) {
                          delete next[s.id];
                        } else next[s.id] = cur;
                        setSpeciesPbs(next);
                        saveSpeciesPbs(next);
                        flashSaved();
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {section === "konto" && (
        <section className="profile-card" id="konto">
          <h2>Konto</h2>
          {!isSupabaseConfigured() ? (
            <p className="profile-muted">
              Molnet är inte inkopplat (nycklar saknas i bygget). Därför syns
              ingen inloggning här — bara lokal profil i webbläsaren. På Render:
              Environment → VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → Manual
              Deploy.
            </p>
          ) : auth.user ? (
            <div className="profile-account-row">
              <p className="profile-muted">Inloggad · {auth.user.email}</p>
              {auth.isAdmin && (
                <Link className="chip on" to="/admin">
                  Admin-dashboard
                </Link>
              )}
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
              {authMode === "signup" && (
                <div className="profile-legal">
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={ageOk}
                      onChange={(e) => setAgeOk(e.target.checked)}
                    />
                    Jag är 16 år eller äldre
                  </label>
                  <label className="profile-check">
                    <input
                      type="checkbox"
                      checked={termsOk}
                      onChange={(e) => setTermsOk(e.target.checked)}
                    />
                    Jag godkänner{" "}
                    <Link to="/villkor" target="_blank">
                      användarvillkor
                    </Link>{" "}
                    och{" "}
                    <Link to="/integritet" target="_blank">
                      integritetspolicy
                    </Link>
                  </label>
                </div>
              )}
              <button
                type="submit"
                className="cta"
                disabled={
                  authBusy ||
                  (authMode === "signup" && (!ageOk || !termsOk))
                }
              >
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
        )}
    </div>
  );
}

export function ProfilePage() {
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
        <ProfileStudio />
        <div className="profile-legal-links">
          <Link className="chip" to="/hjalp">
            Så funkar det
          </Link>
          <Link className="chip" to="/dela">
            Dela fångst
          </Link>
          <Link className="chip" to="/integritet">
            Integritet
          </Link>
          <Link className="chip" to="/villkor">
            Villkor
          </Link>
        </div>
      </div>
    </div>
  );
}
