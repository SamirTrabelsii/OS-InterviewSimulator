// Monde du hub (étape 9b, partie 2) : géométrie, collisions et chemins.
// Fonctions pures, en pixels logiques d'un monde de 320 × 200 (voir
// src/ui/pixel/scale.ts). Aucune dépendance au navigateur : testable seule.

export const WORLD_W = 320;
export const WORLD_H = 200;
export const TILE = 8;

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

export interface Building {
  gem: Exclude<TargetId, "portail">;
  /** Nom court de l'enseigne (identique pour tous les scénarios). */
  sign: string;
  tone: Tone;
  /** Fichier de sprite (clé de l'atlas). */
  sprite: "building-savoir" | "building-archives" | "building-calcul" | "building-intuition";
  rect: Rect;
}

const BW = 64;
const BH = 48;
const BY = 32;

export const BUILDINGS: readonly Building[] = [
  { gem: "quiz", sign: "SAVOIR", tone: "cyan", sprite: "building-savoir", rect: { x: 12, y: BY, w: BW, h: BH } },
  { gem: "sql", sign: "ARCHIVES", tone: "green", sprite: "building-archives", rect: { x: 92, y: BY, w: BW, h: BH } },
  { gem: "algo", sign: "CALCUL", tone: "magenta", sprite: "building-calcul", rect: { x: 172, y: BY, w: BW, h: BH } },
  { gem: "logique", sign: "INTUITION", tone: "amber", sprite: "building-intuition", rect: { x: 252, y: BY, w: BW, h: BH } },
];

/** Le Portail : sprite 48 × 48 au centre de la place ; seul le bas est un obstacle. */
export const PORTAL_RECT: Rect = { x: 136, y: 116, w: 48, h: 48 };
const PORTAL_SOLID: Rect = { x: 140, y: 152, w: 40, h: 12 };

/** Zones praticables : la rue (toute la largeur) et la place carrelée. */
const STREET: Rect = { x: 0, y: 80, w: WORLD_W, h: 24 };
const PLAZA: Rect = { x: 96, y: 104, w: 128, h: 96 };
const WALKABLE: readonly Rect[] = [STREET, PLAZA];
const SOLIDS: readonly Rect[] = [PORTAL_SOLID];

/** Points où l'on « entre » : devant chaque porte, et devant le Portail. */
export const TARGETS: Readonly<Record<TargetId, Vec>> = {
  quiz: { x: 12 + 32, y: 86 },
  sql: { x: 92 + 32, y: 86 },
  algo: { x: 172 + 32, y: 86 },
  logique: { x: 252 + 32, y: 86 },
  portail: { x: 160, y: 172 },
};
export const TARGET_IDS = Object.keys(TARGETS) as TargetId[];

export const START: Vec = { x: 160, y: 96 };

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
