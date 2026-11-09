export type SpeciesTone = "perch" | "pike" | "cod" | "flounder" | "other";

export type SpeciesOption = {
  id: string;
  tone: SpeciesTone;
  img: string;
};

export const SPECIES: SpeciesOption[] = [
  { id: "Abborre", tone: "perch", img: "/species/abborre.svg" },
  { id: "Gädda", tone: "pike", img: "/species/gadda.svg" },
  { id: "Torsk", tone: "cod", img: "/species/torsk.svg" },
  { id: "Skrubba", tone: "flounder", img: "/species/skrubba.svg" },
  { id: "Annan", tone: "other", img: "/species/annan.svg" },
];

export const SPECIES_IDS = SPECIES.map((s) => s.id);

/** Compact zone chips when not checked in. */
export const QUICK_ZONES: { id: string; name: string }[] = [
  { id: "slottsparken", name: "Slottsparken" },
  { id: "kungsparken", name: "Kungsparken" },
  { id: "centralen", name: "Centralen" },
  { id: "davidshall", name: "Davidshall" },
  { id: "roddklubben", name: "Roddklubben" },
  { id: "hovratten", name: "Hovrätten" },
  { id: "malmohus", name: "Malmöhus" },
  { id: "triangeln_soder", name: "Södra kanalen" },
];
