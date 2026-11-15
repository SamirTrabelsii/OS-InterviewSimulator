import type { Col } from "./palette";
import { Pix, bayer, rng } from "./pix";

/** Portail : 64 × 88. Le bas de l'estrade touche y = 87. */
export const PW = 64;
export const PH = 88;
export const PORTAL_CENTER = { x: 32, y: 47 };
/** Position des 4 emplacements de gemmes (dans l'ordre : quiz, sql, algo, logique). */
export const SOCKETS = [17, 25, 33, 41].map((x) => ({ x, y: 9, w: 6, h: 6 }));
const SOCKET_COLORS: Col[] = ["cyL", "grL", "mgL", "amL"];

const RAMP: Col[] = ["n1", "v1", "v2", "v3", "cyL", "cyW"];

function platform(p: Pix, open: boolean): void {
  // estrade : disque vu de trois quarts, épaisseur visible
  p.ellipse(32, 79, 31.5, 9.5, "n3");
  for (let y = 79; y < 87; y++) for (let x = 0; x < PW; x++) {
    const u = (x + 0.5 - 32) / 31.5;
    const v = (y + 0.5 - 79) / 9.5;
    if (u * u + v * v <= 1 && y >= 82) p.set(x, y, y > 84 ? "n2" : "i1");
  }
  p.ellipse(32, 77, 31.5, 9.5, "i2");
  p.ellipse(32, 77, 29.5, 8.5, "i1");
  p.ellipse(32, 77, 24, 6.5, "n3");
  // anneau runique
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const x = Math.round(32 + Math.cos(a) * 26.5);
    const y = Math.round(77 + Math.sin(a) * 7.5);
    p.set(x, y, open ? (k % 2 ? "v3" : "cyL") : k % 4 === 0 ? "v2" : "v1");
  }
  // reflet de l'arête avant
  for (let x = 4; x < 60; x++) {
    const u = (x + 0.5 - 32) / 31.5;
    const y = Math.round(77 + Math.sqrt(Math.max(0, 1 - u * u)) * 9.5);
    p.set(x, y, "s1");
  }
}

function pillar(p: Pix, x: number, mirrored: boolean, open: boolean): void {
  const w = 11;
  p.rect(x, 17, w, 60, "i2");
  p.vline(mirrored ? x + w - 1 : x, 17, 60, mirrored ? "n3" : "s2");
  p.vline(mirrored ? x : x + w - 1, 17, 60, mirrored ? "s1" : "n3");
  p.vline(mirrored ? x + w - 2 : x + 1, 17, 60, mirrored ? "i1" : "s1");
  for (let y = 26; y < 76; y += 12) {
    p.hline(x, y, w, "n3").hline(x + 1, y + 1, w - 2, "s1");
  }
  // boulons
  for (const y of [21, 31, 43, 55, 67]) {
    const bx = mirrored ? x + 3 : x + w - 4;
    p.set(bx, y, "s2").set(bx + 1, y, "i1");
  }
  // veine lumineuse sur la face intérieure
  const ix = mirrored ? x : x + w - 1;
  for (let y = 20; y < 76; y += 2) p.set(ix, y, open ? (y % 4 ? "v3" : "cyL") : "v1");
  p.dither(x, 17, w, 60, "n2", 3);
  // chapiteau et socle
  p.rect(x - 2, 13, w + 4, 5, "s1").hline(x - 2, 13, w + 4, "s2").hline(x - 2, 17, w + 4, "n3");
  p.rect(x - 2, 72, w + 4, 6, "s1").hline(x - 2, 72, w + 4, "s2").hline(x - 2, 77, w + 4, "n3");
  p.dither(x - 2, 73, w + 4, 4, "i2", 5);
}

function lintel(p: Pix, lit: boolean[]): void {
  // linteau cintré
  p.rect(3, 6, 58, 12, "i2");
  p.rect(5, 4, 54, 2, "i2").rect(10, 2, 44, 2, "i2");
  p.hline(10, 2, 44, "s2").hline(5, 4, 5, "s2").hline(54, 4, 5, "s2").hline(3, 6, 2, "s2").hline(59, 6, 2, "s2");
  p.hline(5, 4, 54, "s1");
  p.hline(10, 2, 44, "s2");
  p.hline(3, 17, 58, "n3").hline(3, 16, 58, "i1");
  p.vline(3, 6, 12, "s1").vline(60, 6, 12, "n3");
  p.dither(3, 6, 58, 10, "s1", 2);
  // emplacements des gemmes
  SOCKETS.forEach((s, i) => {
    p.rect(s.x - 1, s.y - 1, s.w + 2, s.h + 2, "ink").frame(s.x - 1, s.y - 1, s.w + 2, s.h + 2, "n1");
    p.rect(s.x, s.y, s.w, s.h, lit[i] ? SOCKET_COLORS[i] : "n2");
    if (lit[i]) {
      p.rect(s.x + 1, s.y + 1, 2, 2, "moon").hline(s.x, s.y + s.h - 1, s.w, "ink").dither(s.x, s.y + s.h - 2, s.w, 1, "ink", 6);
    } else {
      // empreinte vide : losange creux
      p.set(s.x + 2, s.y + 1, "i1").set(s.x + 3, s.y + 1, "i1").set(s.x + 1, s.y + 2, "i1").set(s.x + 4, s.y + 2, "i1").set(s.x + 1, s.y + 3, "i1").set(s.x + 4, s.y + 3, "i1").set(s.x + 2, s.y + 4, "i1").set(s.x + 3, s.y + 4, "i1");
    }
  });
  // cristal de faîte
  p.rect(30, 0, 4, 2, "v2").set(31, 0, "v3").set(32, 0, "v3");
}

/** Intérieur fermé : champ de scellement sombre, cadenas. */
function sealed(p: Pix, frame: number): void {
  const r = rng(9);
  for (let y = 18; y < 76; y++)
    for (let x = 16; x < 48; x++) {
      p.set(x, y, "ink");
      const k = (x - 16) % 4;
      if (k === 1 && bayer(x, y) < 5) p.set(x, y, "n1");
    }
  // barreaux d'énergie éteints
  for (let x = 19; x < 47; x += 6) p.vline(x, 20, 54, "n2");
  p.scatter(16, 18, 32, 58, "n2", 0.015, r);
  // quelques étincelles de scellement
  const hx = 20 + ((frame * 7) % 24);
  const hy = 30 + ((frame * 13) % 36);
  p.set(hx, hy, "v2");
  // cadenas
  p.rect(28, 45, 8, 7, "s1").hline(28, 45, 8, "s2").hline(28, 51, 8, "n3").vline(28, 45, 7, "s2").vline(35, 45, 7, "i1");
  p.rect(30, 41, 4, 5, "n3").rect(31, 42, 2, 3, "ink").hline(30, 41, 4, "s2");
  p.rect(31, 47, 2, 3, "ink");
  p.set(31, 47, "am");
}

function swirl(p: Pix, frame: number, power: number): void {
  const cx = PORTAL_CENTER.x;
  const cy = PORTAL_CENTER.y;
  const rx = 16;
  const ry = 29;
  const r0 = rng(100 + frame);
  for (let y = 18; y < 76; y++)
    for (let x = 16; x < 48; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const r = Math.hypot(u, v);
      let c: Col = "ink";
      const rr = r / power;
      if (rr <= 1) {
        const th = Math.atan2(v, u);
        const s = Math.sin(th * 3 + rr * 6.5 - (frame * Math.PI) / 3);
        const s2 = Math.sin(th * 2 - rr * 3 + (frame * Math.PI) / 3);
        const val = 0.5 + 0.35 * s + 0.15 * s2;
        const core = Math.pow(1 - rr, 0.9);
        const lvl = (val * 0.55 + core * 0.75) * 5.2 + (bayer(x, y) - 7.5) / 9 - rr * 0.7;
        c = RAMP[Math.max(0, Math.min(5, Math.floor(lvl)))];
        if (rr > 0.88) c = bayer(x, y) < 8 ? "v1" : "n1";
        if (rr < 0.12) c = frame % 2 ? "cyW" : "moon";
      } else if (rr < 1.18) c = bayer(x, y) < 6 ? "n1" : "ink";
      p.set(x, y, c);
    }
  // étincelles qui spiralent
  for (let k = 0; k < 6; k++) {
    const a = r0() * Math.PI * 2 + frame;
    const d = 0.3 + r0() * 0.6;
    p.set(Math.round(cx + Math.cos(a) * rx * d * power), Math.round(cy + Math.sin(a) * ry * d * power), "cyW");
  }
}

export type PortalState = "closed" | "charging" | "open";

export function makePortal(state: PortalState, frame = 0): Pix {
  const p = new Pix(PW, PH);
  const open = state === "open";
  const lit = state === "closed" ? [false, false, false, false] : state === "charging" ? [true, true, true, false] : [true, true, true, true];
  platform(p, open || state === "charging");
  if (state === "closed") sealed(p, frame);
  else swirl(p, frame, state === "charging" ? 0.55 : 1);
  pillar(p, 5, false, state !== "closed");
  pillar(p, 48, true, state !== "closed");
  lintel(p, lit);
  // reflet du champ sur les piliers et au sol
  if (state !== "closed") {
    p.dither(18, 18, 2, 56, "v2", state === "open" ? 6 : 2);
    p.dither(44, 18, 2, 56, "v2", state === "open" ? 6 : 2);
    p.dither(20, 66, 24, 9, state === "open" ? "cyL" : "v2", 3);
  }
  return p.outline({ sides: true, bottom: false });
}

export const PORTAL_FRAMES = { closed: 2, charging: 4, open: 6 } as const;
