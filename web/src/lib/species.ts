export type SpeciesTone = "perch" | "pike" | "cod" | "flounder" | "other";

export type SpeciesOption = {
  id: string;
  tone: SpeciesTone;
  img: string;
};

export const SPECIES: SpeciesOption[] = [
  { id: "Abborre", tone: "perch", img: "/images/fish/abborre.png" },
  { id: "Gädda", tone: "pike", img: "/images/fish/gadda.png" },
  { id: "Torsk", tone: "cod", img: "/images/fish/torsk.png" },
  { id: "Skrubba", tone: "flounder", img: "/images/fish/skrubba.png" },
  { id: "Annan", tone: "other", img: "/images/fish/annan.png" },
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
