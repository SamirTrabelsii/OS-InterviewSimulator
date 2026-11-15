/**
 * Palette fermée du monde du hub : 32 couleurs, pas une de plus.
 * Bleus nuit et violets profonds, trois rampes néon (cyan, magenta, vert),
 * ambre, deux teintes de peau. Chaque sprite ne pioche que dans cette liste
 * (vérifié par art.test.ts) ; les lumières et la pluie, elles, s'ajoutent
 * par-dessus à l'exécution.
 */
export const PALETTE = {
  // Nuit
  void: "#07080f",
  ink: "#0b0c18",
  n1: "#10132a",
  n2: "#171b36",
  n3: "#1f2447",
  i1: "#2a3060",
  i2: "#3a4170",
  s1: "#4d5690",
  s2: "#6b73ac",
  mist: "#a7a3d1",
  moon: "#e8e6ff",
  // Violets
  plum: "#241a3c",
  v1: "#4a2f94",
  v2: "#7a52e0",
  v3: "#b08cff",
  // Cyan
  cyD: "#0e4458",
  cy: "#1fb8d6",
  cyL: "#3ef0ff",
  cyW: "#b8faff",
  // Magenta
  mgD: "#62185c",
  mg: "#c93aae",
  mgL: "#ff4fd8",
  mgW: "#ffbaf0",
  // Vert
  grD: "#124d3a",
  gr: "#2fd68a",
  grL: "#4dffa6",
  // Ambre
  amD: "#7a4812",
  am: "#ffb547",
  amL: "#ffd98a",
  // Terre et peau
  rust: "#3a2a38",
  skinD: "#b9795f",
  skin: "#f2c3a0",
} as const;

export type Col = keyof typeof PALETTE;
export const COLORS = Object.keys(PALETTE) as Col[];

/** « #rrggbb » → entier ABGR little-endian (format de ImageData sur Uint32Array). */
export function pack(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export const PACKED: Record<Col, number> = Object.fromEntries(COLORS.map((c) => [c, pack(PALETTE[c])])) as Record<Col, number>;
const BY_PACKED = new Map<number, Col>(COLORS.map((c) => [PACKED[c], c]));
export const colOf = (v: number): Col | undefined => BY_PACKED.get(v >>> 0);

/** Échelon plus sombre de la même teinte : sert aux contours teintés (jamais de noir plaqué). */
export const DARKER: Record<Col, Col> = {
  void: "void", ink: "void", n1: "ink", n2: "n1", n3: "n1", i1: "n2", i2: "n3", s1: "i1", s2: "i2", mist: "s1", moon: "s2",
  plum: "ink", v1: "plum", v2: "v1", v3: "v1",
  cyD: "n1", cy: "cyD", cyL: "cyD", cyW: "cy",
  mgD: "plum", mg: "mgD", mgL: "mgD", mgW: "mg",
  grD: "n1", gr: "grD", grL: "grD",
  amD: "plum", am: "amD", amL: "amD",
  rust: "ink", skinD: "plum", skin: "skinD",
};

/** RGB d'une couleur de la palette (pour les lumières). */
export function rgb(c: Col): [number, number, number] {
  const n = parseInt(PALETTE[c].slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type Tone = "cyan" | "green" | "magenta" | "amber" | "violet";
/** Rampe néon d'un ton : ombre, base, lumière, blanc chaud. */
export const RAMP: Record<Tone, { D: Col; m: Col; L: Col; W: Col }> = {
  cyan: { D: "cyD", m: "cy", L: "cyL", W: "cyW" },
  green: { D: "grD", m: "gr", L: "grL", W: "grL" },
  magenta: { D: "mgD", m: "mg", L: "mgL", W: "mgW" },
  amber: { D: "amD", m: "am", L: "amL", W: "amL" },
  violet: { D: "v1", m: "v2", L: "v3", W: "moon" },
};
