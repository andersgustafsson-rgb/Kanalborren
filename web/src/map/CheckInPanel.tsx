import { useRef, useState } from "react";
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
  spectator?: boolean;
  onLocate: () => void;
  onGoToCanal?: () => void;
  onSimulateCanal?: () => void;
  onSofaDemoCheckIn: () => void;
  onTogglePickOnMap: () => void;
  onVisibility: (v: Visibility) => void;
  onOpenForCompany: (v: boolean) => void;
  onNote: (v: string) => void;
  onCheckIn: () => void;
  onExtend: () => void;
  onHide: (tripNote?: string | null) => void;
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
  onLocate,
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
  const [ending, setEnding] = useState(false);
  const [tripNote, setTripNote] = useState("");

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
            {session ? (
              <>
                <strong>Du är ute</strong>
                <small>
                  {session.zoneName || "Kanalen"} ·{" "}
                  {formatRemaining(leftLive || left)} kvar
                </small>
              </>
            ) : (
              <>
                <strong>Checka in</strong>
                <small>
                  {fix
                    ? suggestedZone?.name || "Position klar"
                    : "Du syns inte på kartan ännu"}
                </small>
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

        {!session && (
          <div className="checkin-choices">
            <button
              type="button"
              className="cta"
              disabled={locating}
              onClick={onLocate}
            >
              {locating ? "Hämtar din position…" : "Jag är vid kanalen"}
            </button>
            <p className="checkin-meta">
              Hämtar din plats. Sen trycker du Checka in.
            </p>
            <div className="checkin-actions">
              <button
                type="button"
                className={pickOnMap ? "chip on" : "chip"}
                aria-pressed={pickOnMap}
                onClick={onTogglePickOnMap}
              >
                Välj på kartan
              </button>
              <button type="button" className="chip" onClick={onSofaDemoCheckIn}>
                Testa hemifrån
              </button>
            </div>
          </div>
        )}

        {locateError && <p className="checkin-error">{locateError}</p>}
        {pickOnMap && (
          <p className="checkin-meta">Tryck på kartan där du står.</p>
        )}

        {fix && (
          <p className="checkin-place" role="status">
            <strong>{suggestedZone?.name || "Kanalen"}</strong>
            <span>
              {simulated ? "vald plats" : "din position"}
              {fix.accuracy != null ? ` · ±${Math.round(fix.accuracy)} m` : ""}
            </span>
          </p>
        )}

        <fieldset className="checkin-vis">
          <legend>Vad andra ser</legend>
          <div className="checkin-vis-grid">
            {(
              [
                [
                  "ghost",
                  "Dold",
                  openForCompany
                    ? "Ingen nål — syns i zonlista"
                    : "Ingen ser dig",
                ],
                ["zone", "Zon", "Bara området"],
                ["precise", "Exakt", "Ungefär var du står"],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                className={visibility === value ? "vis-opt on" : "vis-opt"}
                aria-pressed={visibility === value}
                onClick={() => onVisibility(value)}
              >
                <strong>{label}</strong>
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="checkin-check">
          <input
            type="checkbox"
            checked={openForCompany}
            onChange={(e) => onOpenForCompany(e.target.checked)}
          />
          Öppen för fiskesällskap
          {visibility === "ghost" ? " (utan kartnål)" : ""}
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
            Checka in · 4 timmar
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
            {!ending ? (
              <div className="checkin-actions">
                <button type="button" className="chip" onClick={onExtend}>
                  +30 min
                </button>
                <button
                  type="button"
                  className="chip danger"
                  onClick={() => setEnding(true)}
                >
                  Avsluta
                </button>
              </div>
            ) : (
              <div className="checkin-end">
                <label className="checkin-note">
                  Kort om turen (valfritt)
                  <input
                    type="text"
                    maxLength={400}
                    value={tripNote}
                    placeholder="t.ex. bra abborre vid bron, mulen kväll"
                    onChange={(e) => setTripNote(e.target.value)}
                  />
                </label>
                <div className="checkin-actions">
                  <button
                    type="button"
                    className="chip"
                    onClick={() => {
                      setEnding(false);
                      setTripNote("");
                    }}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className="chip danger"
                    onClick={() => {
                      onHide(tripNote.trim() || null);
                      setEnding(false);
                      setTripNote("");
                    }}
                  >
                    Avsluta turen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
