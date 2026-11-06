import { useRef } from "react";
import type { CheckInSession, Visibility } from "./checkinStorage";
import { formatRemaining, remainingMs } from "./checkinStorage";
import type { ResolvedZone } from "./geo";
import { AVATARS, type PresetAvatarId } from "./avatars";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locating: boolean;
  locateError: string | null;
  fix: { lat: number; lng: number; accuracy: number | null } | null;
  simulated: boolean;
  pickOnMap: boolean;
  suggestedZone: ResolvedZone | null;
  session: CheckInSession | null;
  now: number;
  visibility: Visibility;
  openForCompany: boolean;
  note: string;
  avatarSrc: string;
  avatarId: string;
  onPresetAvatar: (id: PresetAvatarId) => void;
  onUploadAvatar: (file: File) => void;
  uploadError: string | null;
  spectator: boolean;
  onLocate: () => void;
  onGoToCanal: () => void;
  onSimulateCanal: () => void;
  onSofaDemoCheckIn: () => void;
  onTogglePickOnMap: () => void;
  onVisibility: (v: Visibility) => void;
  onOpenForCompany: (v: boolean) => void;
  onNote: (v: string) => void;
  onCheckIn: () => void;
  onExtend: () => void;
  onHide: () => void;
};

export function CheckInPanel({
  open,
  onOpenChange,
  locating,
  locateError,
  fix,
  simulated,
  pickOnMap,
  suggestedZone,
  session,
  now,
  visibility,
  openForCompany,
  note,
  avatarSrc,
  avatarId,
  onPresetAvatar,
  onUploadAvatar,
  uploadError,
  spectator,
  onLocate,
  onGoToCanal,
  onSimulateCanal,
  onSofaDemoCheckIn,
  onTogglePickOnMap,
  onVisibility,
  onOpenForCompany,
  onNote,
  onCheckIn,
  onExtend,
  onHide,
}: Props) {
  const left = session ? remainingMs({ ...session }) : 0;
  const leftLive = session
    ? Math.max(0, Date.parse(session.expiresAt) - now)
    : 0;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside
      className={`checkin-sheet${open ? " open" : ""}`}
      aria-label="Checka in"
    >
      <button
        type="button"
        className="sheet-handle"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="sheet-grip" aria-hidden />
        <span className="sheet-peek">
          <img className="sheet-avatar-img" src={avatarSrc} alt="" />
          <span className="sheet-peek-text">
            {spectator ? (
              <>
                <strong>Åskådarläge</strong>
                <small>Hemma? Testa check-in från soffan ↓</small>
              </>
            ) : session ? (
              <>
                <strong>Du fiskar</strong>
                <small>
                  {session.zoneName || session.visibility} ·{" "}
                  {formatRemaining(leftLive || left)} kvar
                </small>
              </>
            ) : (
              <>
                <strong>Checka in</strong>
                <small>Visa dig på kanalen · välj avatar</small>
              </>
            )}
          </span>
          <span className="sheet-chevron" aria-hidden>
            {open ? "▾" : "▴"}
          </span>
        </span>
      </button>

      <div className="sheet-body" hidden={!open}>
        <div className="avatar-picker" role="group" aria-label="Avatar">
          {AVATARS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={
                avatarId === a.id ? "avatar-opt on" : "avatar-opt"
              }
              aria-pressed={avatarId === a.id}
              title={a.label}
              onClick={() => onPresetAvatar(a.id)}
            >
              <img src={a.src} alt={a.label} />
            </button>
          ))}
          <button
            type="button"
            className={
              avatarId === "custom" ? "avatar-opt on upload" : "avatar-opt upload"
            }
            title="Ladda upp egen"
            aria-pressed={avatarId === "custom"}
            onClick={() => fileRef.current?.click()}
          >
            {avatarId === "custom" ? (
              <img src={avatarSrc} alt="Din bild" />
            ) : (
              <span className="upload-label">+</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadAvatar(file);
              e.target.value = "";
            }}
          />
        </div>
        {uploadError && <p className="checkin-error">{uploadError}</p>}
        <p className="checkin-meta">Tryck + för egen bild (sparas lokalt).</p>

        {!session && (
          <button
            type="button"
            className="cta sofa-cta"
            onClick={onSofaDemoCheckIn}
          >
            Testa check-in från soffan
          </button>
        )}

        <div className="checkin-actions">
          <button type="button" className="chip on" onClick={onGoToCanal}>
            Bara kika (åskådare)
          </button>
          <button
            type="button"
            className="chip"
            onClick={onLocate}
            disabled={locating}
          >
            {locating ? "Hämtar GPS…" : "Min GPS"}
          </button>
          <button type="button" className="chip" onClick={onSimulateCanal}>
            Lägg mig vid kanalen
          </button>
          <button
            type="button"
            className={pickOnMap ? "chip on" : "chip"}
            aria-pressed={pickOnMap}
            onClick={onTogglePickOnMap}
          >
            Peka plats
          </button>
        </div>
        <p className="checkin-meta">
          Hemma i soffan: använd <strong>Testa check-in från soffan</strong> —
          du syns i zon (märkt som test). På riktigt vid kanalen: Min GPS.
        </p>

        {locateError && <p className="checkin-error">{locateError}</p>}
        {pickOnMap && (
          <p className="checkin-meta">Klicka på kanalen för simulerad plats.</p>
        )}

        {fix && (
          <p className="checkin-meta">
            {simulated ? "Simulerad" : "GPS OK"}
            {fix.accuracy != null ? ` (±${Math.round(fix.accuracy)} m)` : ""}
            {suggestedZone ? (
              <>
                {" "}
                · <strong>{suggestedZone.name}</strong>
              </>
            ) : null}
          </p>
        )}

        <fieldset className="checkin-vis">
          <legend>Synlighet</legend>
          {(
            [
              ["ghost", "Ghost", "Ingen publik prick"],
              ["zone", "Zon", "Bara zonnamn"],
              ["precise", "Exakt", "Avatar ~60 m"],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="checkin-radio">
              <input
                type="radio"
                name="visibility"
                checked={visibility === value}
                onChange={() => onVisibility(value)}
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="checkin-check">
          <input
            type="checkbox"
            checked={openForCompany}
            onChange={(e) => onOpenForCompany(e.target.checked)}
          />
          Öppen för fiskesällskap
        </label>

        <label className="checkin-note">
          Kort text
          <input
            type="text"
            maxLength={120}
            value={note}
            placeholder="t.ex. jigg, abborre"
            onChange={(e) => onNote(e.target.value)}
          />
        </label>

        {!session ? (
          <button
            type="button"
            className="cta"
            disabled={!fix}
            onClick={onCheckIn}
          >
            Checka in (2 h)
          </button>
        ) : (
          <div className="checkin-active">
            <p>
              Aktiv: <strong>{session.visibility}</strong>
              {session.zoneName ? ` · ${session.zoneName}` : ""}
              {session.openForCompany ? " · öppen för sällskap" : ""}
              <br />
              Kvar: {formatRemaining(leftLive || left)}
            </p>
            <div className="checkin-actions">
              <button type="button" className="chip" onClick={onExtend}>
                +30 min
              </button>
              <button type="button" className="chip danger" onClick={onHide}>
                Dölj nu
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
