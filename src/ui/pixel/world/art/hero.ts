import type { Col } from "./palette";
import { Pix } from "./pix";

/** Candidat : 16 × 24, quatre directions. Le côté droit est le miroir du gauche. */
export const PW = 16;
export const PH = 24;

export type Dir = "down" | "up" | "left" | "right";
export type Pose = "idle" | "walk";

/** Cadence : balancement des jambes et rebond du buste par image de marche. */
const STEP = [1, 0, -1, 0] as const;
const LIFT_L = [0, 0, 1, 2] as const;
const LIFT_R = [1, 2, 0, 0] as const;
const BOB = [0, -1, 0, -1] as const;

function legsFront(p: Pix, liftL: number, liftR: number): void {
  for (const [x, lift] of [[5, liftL], [8, liftR]] as const) {
    const bottom = 22 - lift;
    p.rect(x, 18, 3, bottom - 18 - 1, "i1").vline(x, 18, bottom - 18 - 1, "i2").vline(x + 2, 18, bottom - 18 - 1, "n3");
    // botte : tige, semelle cyan discrète
    p.rect(x, bottom - 2, 3, 2, "i2").hline(x, bottom - 2, 3, "s1");
    p.hline(x, bottom, 3, "n2").set(x, bottom, "cyD");
  }
}

function headFront(p: Pix, h: number, blink: boolean): void {
  // cheveux
  p.hline(5, h, 6, "v1").rect(4, h + 1, 8, 2, "v1").hline(5, h + 1, 3, "v2").set(6, h, "v2");
  p.hline(4, h + 3, 3, "v1").hline(9, h + 3, 3, "v1").set(7, h + 3, "v2");
  p.set(4, h + 4, "plum").set(11, h + 4, "plum").set(4, h + 5, "plum").set(11, h + 5, "plum");
  // visage
  p.rect(5, h + 3, 6, 6, "skin").rect(7, h + 3, 2, 1, "skin").hline(5, h + 3, 2, "v1").hline(9, h + 3, 2, "v1");
  p.vline(10, h + 4, 5, "skinD").hline(6, h + 8, 4, "skinD").set(5, h + 8, "skinD");
  if (blink) {
    p.hline(6, h + 5, 1, "skinD").hline(9, h + 5, 1, "skinD");
  } else {
    p.rect(6, h + 5, 1, 2, "ink").rect(9, h + 5, 1, 2, "ink").set(6, h + 5, "n3").set(9, h + 5, "n3");
  }
  p.hline(7, h + 7, 2, "skinD");
  // casque : coques cyan sur les oreilles, arceau sous les cheveux
  p.rect(3, h + 3, 1, 3, "cyL").set(3, h + 5, "cy").rect(12, h + 3, 1, 3, "cy").set(12, h + 3, "cyL");
  p.hline(4, h + 2, 8, "i2").dither(4, h + 2, 8, 1, "cyD", 6);
}

function headBack(p: Pix, h: number): void {
  p.rect(4, h + 1, 8, 8, "v1").hline(5, h, 6, "v1").rect(5, h + 1, 3, 2, "v2").set(9, h + 2, "v2");
  p.hline(5, h + 8, 6, "plum").hline(4, h + 7, 8, "plum").dither(4, h + 4, 8, 4, "plum", 5);
  p.vline(8, h + 1, 8, "plum");
  p.rect(3, h + 3, 1, 3, "cyL").rect(12, h + 3, 1, 3, "cy");
  p.hline(4, h + 2, 8, "i2").dither(4, h + 2, 8, 1, "cyD", 6);
}

function torsoFront(p: Pix, ub: number, armL: number, armR: number, back: boolean): void {
  const y0 = 11 + ub;
  // capuche sur les épaules
  p.hline(3, y0, 10, "mgD").hline(4, y0 - 1, 8, "mgD");
  // corps
  p.rect(4, y0 + 1, 8, 17 - y0, "mg");
  p.vline(4, y0 + 1, 17 - y0, "mgL").vline(10, y0 + 1, 17 - y0, "mgD").vline(11, y0 + 1, 17 - y0, "mgD");
  p.hline(4, 17, 8, "mgD");
  if (back) {
    p.vline(7, y0 + 1, 16 - y0, "mgD").vline(8, y0 + 1, 16 - y0, "mgD");
    p.rect(7, y0 + 3, 2, 2, "cyL").set(7, y0 + 3, "cyW"); // l'écusson de dos
    p.hline(5, y0 + 1, 6, "mgD");
  } else {
    p.vline(6, y0 + 1, 4, "mgW").vline(9, y0 + 1, 4, "mgW").set(6, y0 + 5, "mgL").set(9, y0 + 5, "mgL");
    p.hline(5, 15, 6, "mgD").vline(5, 15, 2, "mgD").vline(10, 15, 2, "mgD");
    p.dither(5, 14, 5, 1, "mgD", 4);
  }
  // bras
  for (const [x, dy, side] of [[2, armL, 0], [12, armR, 1]] as const) {
    const top = y0 + 1 + dy;
    p.rect(x, top, 2, 6, "mg").vline(side ? x + 1 : x, top, 6, side ? "mgD" : "mgL");
    p.rect(x, top + 6, 2, 2, back ? "skinD" : "skin").hline(x, top + 7, 2, "skinD");
  }
}

function frontView(dir: "down" | "up", pose: Pose, frame: number): Pix {
  const p = new Pix(PW, PH);
  const walk = pose === "walk";
  const ub = walk ? BOB[frame % 4] : frame % 2; // marche : le buste monte ; repos : il s'affaisse
  const step = walk ? STEP[frame % 4] : 0;
  legsFront(p, walk ? LIFT_L[frame % 4] : 0, walk ? LIFT_R[frame % 4] : 0);
  const back = dir === "up";
  torsoFront(p, ub, -step, step, back);
  const h = 2 + ub;
  if (back) headBack(p, h);
  else headFront(p, h, false);
  return p.outline();
}

function sideView(pose: Pose, frame: number): Pix {
  const p = new Pix(PW, PH);
  const walk = pose === "walk";
  const f = frame % 4;
  const ub = walk ? BOB[f] : frame % 2;
  const nearX = walk ? [4, 6, 8, 6][f] : 6;
  const farX = walk ? [8, 6, 4, 6][f] : 7;
  const liftN = walk ? [0, 0, 1, 2][f] : 0;
  const liftF = walk ? [1, 2, 0, 0][f] : 0;
  const swing = walk ? STEP[f] : 0;

  // jambe éloignée (plus sombre), puis jambe proche
  const leg = (x: number, lift: number, far: boolean) => {
    const bottom = 22 - lift;
    const a: Col = far ? "n3" : "i1";
    p.rect(x, 18, 3, bottom - 19, a).vline(x, 18, bottom - 19, far ? "i1" : "i2");
    p.rect(x - 1, bottom - 2, 4, 2, far ? "i1" : "i2").hline(x - 1, bottom - 2, 4, far ? "i2" : "s1");
    p.hline(x - 1, bottom, 4, "n2").set(x - 1, bottom, "cyD");
  };
  leg(farX, liftF, true);

  const y0 = 11 + ub;
  // bras éloigné
  p.rect(7 + swing, y0 + 2, 2, 6, "mgD").rect(7 + swing, y0 + 8, 2, 2, "skinD");
  // capuche dans le dos, torse
  p.rect(8, y0 - 1, 4, 4, "mgD").hline(9, y0 - 2, 3, "mgD");
  p.rect(5, y0 + 1, 7, 17 - y0, "mg").vline(5, y0 + 1, 17 - y0, "mgL").vline(11, y0 + 1, 17 - y0, "mgD").hline(5, 17, 7, "mgD");
  p.vline(7, y0 + 1, 4, "mgW");
  p.hline(6, 15, 4, "mgD");
  leg(nearX, liftN, false);
  // bras proche, devant
  p.rect(6 - swing, y0 + 1, 3, 6, "mg").vline(6 - swing, y0 + 1, 6, "mgL").hline(6 - swing, y0 + 6, 3, "mgD");
  p.rect(6 - swing, y0 + 7, 2, 2, "skin").hline(6 - swing, y0 + 8, 2, "skinD");

  // tête de profil (regarde à gauche)
  const h = 2 + ub;
  p.hline(6, h, 5, "v1").rect(5, h + 1, 7, 2, "v1").hline(6, h + 1, 3, "v2").set(7, h, "v2");
  p.rect(8, h + 3, 4, 5, "v1").rect(10, h + 3, 2, 6, "plum").set(11, h + 8, "plum");
  p.rect(5, h + 3, 3, 6, "skin").set(4, h + 5, "skin").set(4, h + 6, "skinD").set(5, h + 3, "v1");
  p.vline(7, h + 4, 5, "skinD").hline(5, h + 8, 3, "skinD");
  p.rect(5, h + 5, 1, 2, "ink").set(5, h + 5, "n3");
  p.hline(5, h + 7, 1, "skinD");
  p.hline(5, h + 2, 6, "i2").dither(5, h + 2, 6, 1, "cyD", 6);
  p.rect(8, h + 3, 2, 3, "cyL").set(8, h + 5, "cy");
  return p.outline();
}

export function makePlayer(dir: Dir, pose: Pose, frame: number): Pix {
  if (dir === "right") return sideView(pose, frame).flipX();
  if (dir === "left") return sideView(pose, frame);
  return frontView(dir, pose, frame);
}

export const IDLE_FRAMES = 2;
export const WALK_FRAMES = 4;

// ── Gemmes (12 × 12, scintillement sur 4 images) ─────────────

export type GemKind = "quiz" | "sql" | "algo" | "logique";
const GEM_COLORS: Record<GemKind, { D: Col; m: Col; L: Col }> = {
  quiz: { D: "cyD", m: "cy", L: "cyL" },
  sql: { D: "grD", m: "gr", L: "grL" },
  algo: { D: "mgD", m: "mg", L: "mgL" },
  logique: { D: "amD", m: "am", L: "amL" },
};
const GEM_ROWS: [number, number][] = [[4, 7], [3, 8], [2, 9], [1, 10], [1, 10], [2, 9], [3, 8], [4, 7], [5, 6]];

export function makeGem(kind: GemKind, frame: number): Pix {
  const C = GEM_COLORS[kind];
  const p = new Pix(12, 12);
  GEM_ROWS.forEach(([x0, x1], j) => {
    for (let x = x0; x <= x1; x++) {
      const y = j + 1;
      let c: Col = x <= 5 ? C.m : C.D;
      if (j < 3) c = x <= 5 ? C.L : C.m; // facette du dessus
      if (j >= 5 && x > 5) c = C.D;
      p.set(x, y, c);
    }
  });
  p.hline(2, 4, 8, C.L).vline(5, 2, 7, C.L);
  p.set(4, 3, "moon").set(3, 4, "moon");
  // scintillement : une croix qui change de coin
  const spots = [[9, 2], [2, 8], [10, 7], [3, 2]][frame % 4];
  p.set(spots[0], spots[1], "moon").set(spots[0] - 1, spots[1], C.L).set(spots[0] + 1, spots[1], C.L).set(spots[0], spots[1] - 1, C.L).set(spots[0], spots[1] + 1, C.L);
  return p.outline({ top: true });
}

// ── Bip : le petit drone assistant (12 × 14, 4 images) ───────

export function makeBip(frame: number): Pix {
  const p = new Pix(12, 14);
  const bob = [0, 1, 1, 0][frame % 4];
  // antenne
  p.vline(6, 0 + bob, 2, "s2").set(6, bob, frame % 2 ? "cyW" : "cyL");
  // tête
  p.rect(2, 2 + bob, 8, 7, "mist").hline(3, 2 + bob, 6, "moon").hline(2, 3 + bob, 1, "moon").vline(2, 3 + bob, 5, "moon");
  p.vline(9, 3 + bob, 5, "s2").hline(3, 8 + bob, 6, "s2");
  // écran-visage
  p.rect(3, 4 + bob, 6, 3, "ink");
  const blink = frame === 3;
  if (blink) p.hline(3, 5 + bob, 6, "cy");
  else p.set(4, 5 + bob, "cyL").set(7, 5 + bob, "cyL").set(4, 4 + bob, "cy").set(7, 4 + bob, "cy");
  // oreillettes
  p.rect(1, 4 + bob, 1, 3, "cyL").rect(10, 4 + bob, 1, 3, "cy");
  // propulseur
  p.rect(4, 9 + bob, 4, 1, "i2");
  const flame = [2, 3, 2, 1][frame % 4];
  p.rect(5, 10 + bob, 2, flame, "cyL").set(5, 10 + bob + flame, "cyD").set(6, 10 + bob + flame, "cyD");
  return p.outline({ top: true });
}
