export type CanalKind =
  | "canal"
  | "moat"
  | "basin"
  | "canal_centerline"
  | "bridge"
  | "social_zone"
  | "local_spot"
  | "allowed_fishing"
  | "forbidden"
  | string;

export type CanalProperties = {
  id?: string;
  name?: string;
  kind?: CanalKind;
  water?: string;
  source?: string;
  sources?: string[];
  attribution?: string;
  approximation?: boolean;
  note?: string;
  confidence?: "high" | "approx" | string;
};

export type LayerToggles = {
  canal: boolean;
  spots: boolean;
  zones: boolean;
  bridges: boolean;
  rules: boolean;
  catches: boolean;
};

/** Base map tiles under canal overlays. */
export type MapBasemap = "street" | "satellite" | "hybrid";

export type EditMode = "off" | "move" | "add";
