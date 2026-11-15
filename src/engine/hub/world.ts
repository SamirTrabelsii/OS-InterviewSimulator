// Monde du hub (étape 9b, partie 2) : géométrie, collisions et chemins.
// Fonctions pures, en pixels logiques d'un monde de 416 × 320 (26 × 20 tuiles
// de 16 px). Aucune dépendance au navigateur : testable seule. Les graphismes
// (src/ui/pixel/world/art) lisent ces positions, jamais l'inverse.

export const WORLD_W = 416;
export const WORLD_H = 320;
export const TILE = 16;

export interface Vec {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TargetId = "quiz" | "sql" | "algo" | "logique" | "portail";
export type Tone = "cyan" | "green" | "magenta" | "amber";
export type BuildingKey = "savoir" | "archives" | "calcul" | "intuition";

export interface Building {
  gem: Exclude<TargetId, "portail">;
  /** Nom court de l'enseigne (identique pour tous les scénarios). */
  sign: string;
  tone: Tone;
  /** Quel bâtiment dessiner. */
  art: BuildingKey;
  /** Emprise du sprite : toit compris. Le bas (y + h) est le pied de la façade. */
  rect: Rect;
}

const BW = 80;
const BH = 112;
const BY = 16;

export const BUILDINGS: readonly Building[] = [
  { gem: "quiz", sign: "SAVOIR", tone: "cyan", art: "savoir", rect: { x: 24, y: BY, w: BW, h: BH } },
  { gem: "sql", sign: "ARCHIVES", tone: "green", art: "archives", rect: { x: 120, y: BY, w: BW, h: BH } },
  { gem: "algo", sign: "CALCUL", tone: "magenta", art: "calcul", rect: { x: 216, y: BY, w: BW, h: BH } },
  { gem: "logique", sign: "INTUITION", tone: "amber", art: "intuition", rect: { x: 312, y: BY, w: BW, h: BH } },
];

/** Le Portail : sprite 64 × 88 au centre de la place ; seuls ses deux piliers sont des obstacles. */
export const PORTAL_RECT: Rect = { x: 176, y: 220, w: 64, h: 88 };
const PORTAL_SOLIDS: Rect[] = [
  { x: PORTAL_RECT.x + 5, y: PORTAL_RECT.y + 64, w: 11, h: 20 },
  { x: PORTAL_RECT.x + 48, y: PORTAL_RECT.y + 64, w: 11, h: 20 },
];

/** Tout ce qui est au sud de la façade (trottoir, rue, place) se parcourt, sauf les obstacles. */
const GROUND: Rect = { x: 6, y: 136, w: WORLD_W - 12, h: WORLD_H - 3 - 136 };
const WALKABLE: readonly Rect[] = [GROUND];

export type PropName =
  | "lamp"
  | "bench"
  | "vending-mg"
  | "vending-cy"
  | "plant"
  | "crate"
  | "crate-stack"
  | "dumpster"
  | "bin"
  | "bollard"
  | "hydrant"
  | "cabinet"
  | "neon-board";

export interface Prop {
  sprite: PropName;
  /** Bord gauche et largeur du sprite. */
  x: number;
  w: number;
  /** Bas du sprite (pied de l'objet) : sert au tri en profondeur et à l'obstacle. */
  base: number;
  /** Lueur de néon. */
  glow?: { color: "mgL" | "cyL"; r: number; k: number };
  /** Bloque le passage (5 pixels de profondeur au pied de l'objet). */
  solid?: boolean;
}

export const PROPS: readonly Prop[] = [
  { sprite: "lamp", x: 104, w: 16, base: 152, solid: true },
  { sprite: "lamp", x: 200, w: 16, base: 152, solid: true },
  { sprite: "lamp", x: 296, w: 16, base: 152, solid: true },
  { sprite: "lamp", x: 62, w: 16, base: 300, solid: true },
  { sprite: "lamp", x: 338, w: 16, base: 300, solid: true },
  { sprite: "vending-mg", x: 3, w: 16, base: 146, glow: { color: "mgL", r: 24, k: 0.5 }, solid: true },
  { sprite: "vending-cy", x: 397, w: 16, base: 146, glow: { color: "cyL", r: 24, k: 0.5 }, solid: true },
  { sprite: "vending-cy", x: 372, w: 16, base: 270, glow: { color: "cyL", r: 24, k: 0.5 }, solid: true },
  { sprite: "bench", x: 26, w: 32, base: 148, solid: true },
  { sprite: "bench", x: 100, w: 32, base: 268, solid: true },
  { sprite: "bench", x: 284, w: 32, base: 268, solid: true },
  { sprite: "plant", x: 84, w: 16, base: 146, solid: true },
  { sprite: "plant", x: 372, w: 16, base: 146, solid: true },
  { sprite: "plant", x: 118, w: 16, base: 304, solid: true },
  { sprite: "plant", x: 282, w: 16, base: 304, solid: true },
  { sprite: "bin", x: 152, w: 12, base: 150, solid: true },
  { sprite: "cabinet", x: 272, w: 14, base: 148, solid: true },
  { sprite: "hydrant", x: 224, w: 10, base: 154, solid: true },
  { sprite: "bollard", x: 172, w: 8, base: 158, solid: true },
  { sprite: "bollard", x: 248, w: 8, base: 158, solid: true },
  { sprite: "crate-stack", x: 104, w: 16, base: 126 },
  { sprite: "crate", x: 296, w: 16, base: 124 },
  { sprite: "neon-board", x: 22, w: 45, base: 262, glow: { color: "mgL", r: 34, k: 0.45 }, solid: true },
  { sprite: "dumpster", x: 356, w: 32, base: 314, solid: true },
  { sprite: "crate-stack", x: 332, w: 16, base: 316, solid: true },
];

const SOLIDS: readonly Rect[] = [
  ...PORTAL_SOLIDS,
  ...PROPS.filter((p) => p.solid).map((p) => ({ x: p.x, y: p.base - 5, w: p.w, h: 5 })),
];

/** Points où l'on « entre » : devant chaque porte, et dans l'ouverture du Portail. */
export const TARGETS: Readonly<Record<TargetId, Vec>> = {
  quiz: { x: 24 + 40, y: 140 },
  sql: { x: 120 + 40, y: 140 },
  algo: { x: 216 + 40, y: 140 },
  logique: { x: 312 + 40, y: 140 },
  portail: { x: 208, y: 292 },
};
export const TARGET_IDS = Object.keys(TARGETS) as TargetId[];

export const START: Vec = { x: 150, y: 246 };

/** Pieds du personnage : boîte de 6 × 4 pixels centrée sur (x, y). */
const FOOT_HW = 3;
const FOOT_HH = 2;

function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function isWalkable(p: Vec): boolean {
  const corners: Vec[] = [
    { x: p.x - FOOT_HW, y: p.y - FOOT_HH },
    { x: p.x + FOOT_HW - 1, y: p.y - FOOT_HH },
    { x: p.x - FOOT_HW, y: p.y + FOOT_HH - 1 },
    { x: p.x + FOOT_HW - 1, y: p.y + FOOT_HH - 1 },
  ];
  for (const c of corners) {
    if (!WALKABLE.some((r) => inRect(r, c.x, c.y))) return false;
    if (SOLIDS.some((r) => inRect(r, c.x, c.y))) return false;
  }
  return true;
}

export function clampToWorld(p: Vec): Vec {
  return { x: Math.min(WORLD_W - 1, Math.max(0, p.x)), y: Math.min(WORLD_H - 1, Math.max(0, p.y)) };
}

export type Facing = "down" | "up" | "left" | "right";

export function facingOf(dx: number, dy: number, prev: Facing): Facing {
  if (dx === 0 && dy === 0) return prev;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

export const PLAYER_SPEED = 56; // pixels logiques par seconde

/**
 * Déplace le joueur d'une intention (vx, vy ∈ {-1,0,1}) pendant `dtMs`.
 * Les axes sont essayés séparément : on glisse le long d'un obstacle.
 * Un joueur déjà hors zone (état invalide) n'est pas bloqué par isWalkable.
 */
export function stepPlayer(p: Vec, vx: number, vy: number, dtMs: number, speed = PLAYER_SPEED): Vec {
  if (vx === 0 && vy === 0) return p;
  const len = Math.hypot(vx, vy);
  const d = (speed * Math.min(dtMs, 100)) / 1000; // plafonné : un onglet en veille ne téléporte pas
  let out = p;
  const nx = { x: p.x + (vx / len) * d, y: p.y };
  if (isWalkable(nx)) out = nx;
  const ny = { x: out.x, y: out.y + (vy / len) * d };
  if (isWalkable(ny)) out = ny;
  return out;
}

/** Cible la plus proche dont le point d'entrée est à moins de `radius` pixels. */
export function nearTarget(p: Vec, radius = 12): TargetId | null {
  let best: TargetId | null = null;
  let bestD = radius;
  for (const id of TARGET_IDS) {
    const t = TARGETS[id];
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d <= bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

// ── Chemins (A* sur une grille de 4 pixels) ──────────────────
const CELL = 4;
const COLS = WORLD_W / CELL;
const ROWS = WORLD_H / CELL;
const center = (c: number, r: number): Vec => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
const cellOf = (p: Vec) => ({
  c: Math.min(COLS - 1, Math.max(0, Math.floor(p.x / CELL))),
  r: Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / CELL))),
});

function straightClear(a: Vec, b: Vec): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= n; i++) {
    if (!isWalkable({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })) return false;
  }
  return true;
}

/** Plus proche cellule praticable (recherche en couronnes croissantes). */
function nearestWalkableCell(p: Vec): { c: number; r: number } | null {
  const o = cellOf(p);
  for (let k = 0; k < 40; k++) {
    let best: { c: number; r: number } | null = null;
    let bestD = Infinity;
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
        const c = o.c + dc;
        const r = o.r + dr;
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        if (!isWalkable(center(c, r))) continue;
        const d = Math.hypot(center(c, r).x - p.x, center(c, r).y - p.y);
        if (d < bestD) {
          best = { c, r };
          bestD = d;
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/**
 * Chemin praticable de `from` à `to` (le dernier point est `to` ramené à la
 * zone praticable la plus proche), ou null s'il n'y en a pas. Le chemin est
 * simplifié : chaque segment est libre de tout obstacle.
 */
export function findPath(from: Vec, to: Vec): Vec[] | null {
  const s = nearestWalkableCell(from);
  const g = nearestWalkableCell(to);
  if (!s || !g) return null;
  const key = (c: number, r: number) => r * COLS + c;
  const gScore = new Map<number, number>([[key(s.c, s.r), 0]]);
  const prev = new Map<number, number>();
  const open: Array<{ c: number; r: number; f: number }> = [{ ...s, f: 0 }];
  const closed = new Set<number>();
  const h = (c: number, r: number) => Math.abs(c - g.c) + Math.abs(r - g.r);
  let found = false;
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.c, cur.r);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.c === g.c && cur.r === g.r) {
      found = true;
      break;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = cur.c + dc;
      const r = cur.r + dr;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      const k = key(c, r);
      if (closed.has(k) || !isWalkable(center(c, r))) continue;
      const ng = (gScore.get(ck) ?? 0) + 1;
      if (ng < (gScore.get(k) ?? Infinity)) {
        gScore.set(k, ng);
        prev.set(k, ck);
        open.push({ c, r, f: ng + h(c, r) });
      }
    }
  }
  if (!found) return null;

  const cells: Vec[] = [];
  for (let k: number | undefined = key(g.c, g.r); k !== undefined; k = prev.get(k)) {
    cells.push(center(k % COLS, Math.floor(k / COLS)));
  }
  cells.reverse();
  const goal = isWalkable(to) ? to : cells[cells.length - 1];
  const pts = [from, ...cells.slice(1), goal];

  // Simplification : on saute aux points les plus lointains en ligne libre.
  const out: Vec[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !straightClear(pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
