import type { Visibility } from "../map/checkinStorage";

export type PublicFishingSession = {
  id: string;
  userId: string;
  displayName: string;
  visibility: Exclude<Visibility, "ghost">;
  zoneId: string | null;
  zoneName: string | null;
  lat: number | null;
  lng: number | null;
  openForCompany: boolean;
  note: string;
  avatarId: string | null;
  expiresAt: string;
};

export type PublishSessionInput = {
  visibility: Visibility;
  zoneId: string | null;
  zoneName: string | null;
  lat: number | null;
  lng: number | null;
  openForCompany: boolean;
  note: string;
  avatarId: string | null;
  expiresAt: string;
};
