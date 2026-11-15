import { drawText, textWidth } from "./font";
import type { Col, Tone } from "./palette";
import { RAMP } from "./palette";
import { Pix, rng } from "./pix";
import { box } from "./props";

/** Bâtiment : 80 × 112. Le toit commence à y=16 (au-dessus : antennes et dômes), la façade à y=56. */
export const BW = 80;
export const BH = 112;
export const ROOF_Y = 16;
export const LIP_Y = 52;
export const FAC_Y = 56;
export const SIGN = { x: 12, y: 61, w: 56, h: 14 };
export const DOOR = { x: 32, y: 85, w: 16, h: 27 };
const WIN_L = { x: 8, y: 80, w: 16, h: 14 };
const WIN_R = { x: 56, y: 80, w: 16, h: 14 };

export type BuildingId = "savoir" | "archives" | "calcul" | "intuition";

type Ramp = (typeof RAMP)[Tone];

const ICONS: Record<BuildingId, string[]> = {
  savoir: [".###.###.", "#..#.#..#", "#..#.#..#", "#..#.#..#", "#..#.#..#", "#..#.#..#", ".###.###."],
  archives: ["..#####..", ".#######.", ".#.....#.", ".#######.", ".#.....#.", ".#######.", ".#.....#.", "..#####.."],
  calcul: ["....#....", ".#.###.#.", "..#####..", ".###.###.", "####.####", ".###.###.", "..#####..", ".#.###.#.", "....#...."],
  intuition: ["..#####..", ".#.....#.", "#..###..#", "#.#####.#", "#..###..#", ".#.....#.", "..#####.."],
};

function icon(p: Pix, id: BuildingId, x: number, y: number, c: Col, accent: Col): void {
  ICONS[id].forEach((row, j) => [...row].forEach((v, i) => v === "#" && p.set(x + i, y + j, c)));
  if (id === "intuition") p.set(x + 4, y + 3, accent);
  if (id === "calcul") p.set(x + 4, y + 4, accent);
}

const NAMES: Record<BuildingId, string> = { savoir: "SAVOIR", archives: "ARCHIVES", calcul: "CALCUL", intuition: "INTUITION" };
export const TONES: Record<BuildingId, Tone> = { savoir: "cyan", archives: "green", calcul: "magenta", intuition: "amber" };

// ── Éléments communs ─────────────────────────────────────────

function roofSurface(p: Pix, R: Ramp, seed: number): void {
  const r = rng(seed);
  p.rect(0, ROOF_Y, BW, LIP_Y - ROOF_Y, "i2");
  p.scatter(0, ROOF_Y, BW, LIP_Y - ROOF_Y, "i1", 0.07, r).scatter(0, ROOF_Y, BW, LIP_Y - ROOF_Y, "s1", 0.04, r);
  // joints de membrane
  for (const y of [30, 41]) p.hline(3, y, 74, "n3");
  for (let x = 14; x < 78; x += 22) p.vline(x, 20, 10, "n3").vline(x + 11, 31, 10, "n3");
  // parapet arrière (face intérieure) et côtés
  p.hline(0, ROOF_Y, BW, "s2").rect(0, ROOF_Y + 1, BW, 3, "i2").hline(0, ROOF_Y + 4, BW, "n3").dither(0, ROOF_Y + 5, BW, 1, "n3", 8);
  p.rect(0, ROOF_Y, 3, LIP_Y - ROOF_Y, "i2").vline(0, ROOF_Y, LIP_Y - ROOF_Y, "s1").vline(2, ROOF_Y + 4, LIP_Y - ROOF_Y - 4, "n3");
  p.rect(77, ROOF_Y, 3, LIP_Y - ROOF_Y, "i1").vline(79, ROOF_Y, LIP_Y - ROOF_Y, "n3").vline(77, ROOF_Y + 4, LIP_Y - ROOF_Y - 4, "n3");
  // filet néon discret dans le coin du toit
  p.dither(3, ROOF_Y + 5, 74, 1, R.D, 6);
  // corniche avant
  p.hline(0, LIP_Y, BW, "s2").rect(0, LIP_Y + 1, BW, 2, "i2").hline(0, LIP_Y + 3, BW, "n3");
  p.dither(0, LIP_Y + 1, BW, 1, "s1", 5);
}

function brickWall(p: Pix, R: Ramp, seed: number): void {
  const r = rng(seed);
  for (let y = FAC_Y; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const course = (y - FAC_Y) >> 2;
      const ly = (y - FAC_Y) & 3;
      const off = (course & 1) * 4;
      let c: Col = "i1";
      if (ly === 3) c = "n3";
      else if ((x + off) % 8 === 7) c = "n3";
      else if (ly === 0 && ((x + y) & 1) === 0) c = "i2";
      p.set(x, y, c);
    }
  p.scatter(0, FAC_Y, BW, BH - FAC_Y, "n2", 0.025, r).scatter(0, FAC_Y, BW, BH - FAC_Y, "s1", 0.008, r);
  // ombre sous la corniche, teinte du ton
  p.rect(0, FAC_Y, BW, 2, "n2").dither(0, FAC_Y + 2, BW, 3, "n2", 8).dither(0, FAC_Y + 5, BW, 2, "n2", 3);
  p.dither(0, FAC_Y, BW, BH - FAC_Y, R.D, 1);
  // pilastres
  p.rect(0, FAC_Y, 4, BH - FAC_Y, "i2").vline(0, FAC_Y, BH - FAC_Y, "s1").vline(3, FAC_Y, BH - FAC_Y, "n3");
  p.rect(76, FAC_Y, 4, BH - FAC_Y, "i1").vline(76, FAC_Y, BH - FAC_Y, "i2").vline(79, FAC_Y, BH - FAC_Y, "n2");
  for (const y of [FAC_Y + 18, FAC_Y + 36]) {
    p.hline(0, y, 4, "n3");
    p.hline(76, y, 4, "n2");
  }
  // filet néon horizontal sous la corniche
  p.hline(4, FAC_Y + 2, 72, R.D).dither(4, FAC_Y + 2, 72, 1, R.m, 5);
  // plinthe
  p.rect(0, BH - 6, BW, 6, "i2").hline(0, BH - 6, BW, "s1").hline(0, BH - 1, BW, "n2").dither(0, BH - 5, BW, 4, "n3", 4);
}

function sign(p: Pix, id: BuildingId, R: Ramp, lit: boolean): void {
  const { x, y, w, h } = SIGN;
  const L = lit ? R.L : R.D;
  const M = lit ? R.m : R.D;
  p.rect(x, y, w, h, "ink");
  p.frame(x, y, w, h, M);
  p.frame(x + 1, y + 1, w - 2, h - 2, "n2");
  if (lit) {
    p.dither(x + 2, y + 2, w - 4, h - 4, R.D, 2);
    p.dither(x - 1, y - 1, w + 2, 1, R.D, 5);
  }
  // rivets d'angle
  for (const [rx, ry] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) p.set(rx, ry, lit ? R.W : "i1");
  const name = NAMES[id];
  const tw = textWidth(name);
  const iw = ICONS[id][0].length;
  const total = iw + 4 + tw;
  const sx = x + Math.floor((w - total) / 2);
  const ih = ICONS[id].length;
  icon(p, id, sx, y + Math.floor((h - ih) / 2), L, lit ? R.W : R.D);
  drawText(p, sx + iw + 4, y + 4, name, L);
  if (lit) {
    // cœur blanc des lettres : un pixel chaud sur la première ligne
    drawText(p, sx + iw + 4, y + 4, name, L);
    p.hline(sx + iw + 4, y + 10, tw, R.D);
  }
}

function awning(p: Pix, R: Ramp): void {
  const x0 = DOOR.x - 4;
  const x1 = DOOR.x + DOOR.w + 4;
  for (let x = x0; x < x1; x++) {
    const s = ((x - x0) >> 1) % 2 === 0 ? R.D : "ink";
    for (let y = 78; y < 83; y++) p.set(x, y, s);
    if (((x - x0) >> 1) % 2 === 0) p.set(x, 83, R.D);
  }
  p.hline(x0, 78, x1 - x0, R.m).dither(x0, 79, x1 - x0, 1, R.m, 6);
  p.hline(x0 - 1, 77, x1 - x0 + 2, "s1").hline(x0 - 1, 78, 1, "i2");
}

function door(p: Pix, R: Ramp, arched: boolean): void {
  const { x, y, w, h } = DOOR;
  p.rect(x - 1, y - 1, w + 2, h + 1, "s1").vline(x - 1, y - 1, h + 1, "s2").vline(x + w, y - 1, h + 1, "i2");
  p.rect(x, y, w, h, "ink");
  // intérieur éclairé : dégradé chaud vers le sol
  p.dither(x, y + 8, w, 8, "amD", 3).dither(x, y + 14, w, 6, "amD", 8).dither(x, y + 17, w, 6, "am", 4).dither(x, y + 21, w, 6, "amL", 5);
  p.rect(x, y + h - 2, w, 2, "amL").hline(x, y + h - 3, w, "am");
  // silhouette de comptoir
  p.rect(x + 1, y + 14, w - 2, 3, "n1").hline(x + 1, y + 14, w - 2, "i1");
  // battants
  p.vline(x + w / 2, y, h - 2, "i2").vline(x + w / 2 - 1, y, h - 2, "n3");
  p.rect(x + w / 2 - 3, y + 15, 1, 4, "mist").rect(x + w / 2 + 2, y + 15, 1, 4, "mist");
  // reflets sur la vitre
  for (let k = 0; k < 6; k++) p.set(x + 2 + k, y + 7 - k, k % 2 ? "s1" : "i2");
  if (arched) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [w - 1, 0], [w - 2, 0], [w - 1, 1], [2, 0], [w - 3, 0], [0, 2], [w - 1, 2]]) p.set(x + dx, y + dy, "s1");
  }
  // linteau lumineux
  p.hline(x - 1, y - 2, w + 2, R.m).dither(x - 1, y - 1, w + 2, 1, R.D, 8);
  // marches
  p.rect(x - 3, BH - 8, w + 6, 2, "s1").hline(x - 3, BH - 8, w + 6, "s2").rect(x - 5, BH - 6, w + 10, 2, "i2").hline(x - 5, BH - 6, w + 10, "s1");
  p.rect(x + 1, BH - 9, w - 2, 1, R.D);
}

function shadowUnder(p: Pix, x: number, y: number, w: number): void {
  p.dither(x, y + 1, w, 2, "n3", 10);
  p.dither(x + 1, y + 3, w - 2, 1, "n3", 5);
}

// ── Fenêtres ─────────────────────────────────────────────────

function windowFrame(p: Pix, x: number, y: number, w: number, h: number): void {
  p.rect(x - 1, y - 1, w + 2, h + 2, "s1").vline(x - 1, y - 1, h + 2, "s2").vline(x + w, y - 1, h + 2, "i2").hline(x - 1, y + h, w + 2, "i2");
  p.rect(x - 2, y + h + 1, w + 4, 2, "s1").hline(x - 2, y + h + 2, w + 4, "n3");
}

function archWindow(p: Pix, s: typeof WIN_L, R: Ramp, seed: number): void {
  const { x, y, w, h } = s;
  windowFrame(p, x, y, w, h);
  p.rect(x, y, w, h, "n1");
  // étagères de livres éclairées
  const r = rng(seed);
  const books: Col[] = [R.L, "mgL", "am", "v3", R.m, "amL", "grL"];
  for (let row = 0; row < 3; row++) {
    const yy = y + 2 + row * 4;
    for (let i = 0; i < w - 2; i++) if (r() < 0.82) p.vline(x + 1 + i, yy, 3, books[Math.floor(r() * books.length)]);
    p.hline(x, yy + 3, w, "i2");
  }
  p.dither(x, y, w, h, "ink", 6);
  // arche : coins du haut remplis de pierre
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]]) {
    p.set(x + dx, y + dy, "s1");
    p.set(x + w - 1 - dx, y + dy, "s1");
  }
  p.vline(x + w / 2, y, h, "s1");
  p.hline(x, y + 6, w, "s1");
}

function drawerPanel(p: Pix, s: typeof WIN_L, R: Ramp): void {
  const { x, y, w, h } = s;
  p.rect(x - 1, y - 1, w + 2, h + 2, "ink");
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 2; col++) {
      const px = x + col * 8;
      const py = y + row * 5 - (row === 2 ? 0 : 0);
      p.rect(px, py, 7, 4, "i2").hline(px, py, 7, "s1").hline(px, py + 3, 7, "n3");
      p.hline(px + 2, py + 2, 3, "s2").hline(px + 1, py + 1, 1, R.L);
      if ((row + col) % 2 === 0) p.set(px + 5, py + 1, R.L);
    }
  p.rect(x, y + 14, w, 1, "n3");
}

function ribbonWindow(p: Pix, s: typeof WIN_L, R: Ramp, seed: number): void {
  const { x, y, w, h } = s;
  windowFrame(p, x, y, w, h);
  p.rect(x, y, w, h, "ink");
  const r = rng(seed);
  for (let row = 0; row < 4; row++) {
    let cx = x + 1 + Math.floor(r() * 3);
    const yy = y + 1 + row * 3;
    while (cx < x + w - 2) {
      const len = 1 + Math.floor(r() * 4);
      p.hline(cx, yy, Math.min(len, x + w - 1 - cx), row % 2 ? R.L : R.m);
      cx += len + 1 + Math.floor(r() * 2);
    }
  }
  p.dither(x, y, w, h, R.D, 4);
  p.hline(x, y + h - 2, w, "ink");
  for (const [dx, dy] of [[1, 1], [2, 2], [3, 3]]) p.set(x + w - 4 + dx, y + dy - 1, "s1");
}

function roundWindow(p: Pix, s: typeof WIN_L, R: Ramp): void {
  const { x, y, w, h } = s;
  const cx = x + w / 2;
  const cy = y + h / 2;
  p.ellipse(cx, cy, 8, 7, "s1").ellipse(cx, cy, 7, 6, "amD").ellipse(cx, cy, 6, 5, "ink");
  p.ellipse(cx, cy, 6, 5, "am");
  p.ellipse(cx, cy, 5, 4, "amL");
  p.dither(x, y, w, h, "am", 0);
  // pupille
  p.rect(cx - 2, cy - 2, 4, 4, "ink").rect(cx - 1, cy - 1, 2, 2, "amD").set(cx - 1, cy - 1, "amL");
  p.dither(x + 2, y + 1, w - 4, h - 2, "amD", 3);
  p.hline(x - 2, y + h + 1, w + 4, "s1").hline(x - 1, y + h + 2, w + 2, "n3");
  p.set(x + 3, y + 2, "moon").set(x + 4, y + 2, "moon");
  void R;
}

// ── Toits ────────────────────────────────────────────────────

function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const u = (x + 0.5 - cx) / rx;
  const v = (y + 0.5 - cy) / ry;
  return u * u + v * v <= 1;
}

function roofSavoir(p: Pix, R: Ramp): void {
  // coupole vitrée (dessinée à part, puis découpée à sa forme)
  const cx = 26;
  const by = 47;
  const d = new Pix(BW, BH);
  d.rect(cx - 15, by - 22, 31, 20, "cyD");
  d.dither(cx - 14, by - 22, 29, 20, "cy", 4);
  d.dither(cx - 10, by - 17, 12, 10, "cyL", 3);
  for (const k of [-10, -5, 0, 5, 10]) {
    const top = Math.round(by - 3 - Math.sqrt(Math.max(0, 1 - (k * k) / 196)) * 14);
    d.line(cx + Math.round(k * 1.3), by - 3, cx + Math.round(k * 0.45), top, "cyL");
  }
  d.hline(cx - 15, by - 9, 31, "cy");
  d.set(cx - 7, by - 12, "cyW").set(cx - 6, by - 12, "cyW").set(cx - 8, by - 11, "cyW");
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (!inEllipse(x, y, cx, by - 2, 14.5, 15.5) || y > by - 3) d.clear(x, y);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      // rive de la coupole : claire à gauche, sombre à droite
      if (d.get(x, y) && (!d.get(x + 1, y) || !d.get(x, y - 1))) d.set(x, y, x < cx ? "cyW" : "cyD");
    }
  p.blit(d, 0, 0);
  p.rect(cx - 15, by - 2, 31, 4, "i2").hline(cx - 15, by - 2, 31, "s2").hline(cx - 15, by + 1, 31, "n3");
  shadowUnder(p, cx - 12, by + 1, 28);
  // cheminée
  box(p, 58, 48, 9, 12, 3, { top: "i1", hi: "s1", front: "i2", shade: "n3" });
  p.rect(57, 33, 11, 2, "s1").hline(57, 33, 11, "s2");
  p.hline(59, 40, 7, "n3");
  shadowUnder(p, 58, 48, 10);
  // mât et fanion
  p.vline(72, 20, 28, "s2").vline(73, 20, 28, "i1");
  p.rect(66, 21, 6, 4, R.m).hline(66, 21, 6, R.L).hline(66, 24, 6, R.D).set(70, 22, "ink");
  p.set(72, 19, R.W);
  shadowUnder(p, 70, 48, 5);
}

function roofArchives(p: Pix, R: Ramp): void {
  const units = [8, 30, 52];
  for (const [i, x] of units.entries()) {
    box(p, x, 47, 17, 11, 5, { top: "i2", hi: "s1", front: "i1", shade: "n3" });
    // ventilateur sur la face avant
    p.ellipse(x + 8.5, 41.5, 4.5, 4.5, "ink").ellipse(x + 8.5, 41.5, 3.4, 3.4, "n3");
    p.line(x + 6, 41, x + 11, 42, "s1").line(x + 8, 39, x + 9, 44, "s1");
    p.set(x + 8, 41, "s2");
    // grille sur le dessus
    for (let k = 0; k < 4; k++) p.hline(x + 2, 31 + k, 13, k % 2 ? "i1" : "n3");
    p.set(x + 14, 44, i === 1 ? R.L : "i2").set(x + 14, 45, R.D);
    shadowUnder(p, x, 47, 18);
  }
  // goulottes
  p.rect(25, 33, 3, 14, "i2").vline(25, 33, 14, "s1").vline(27, 33, 14, "n3");
  p.rect(47, 36, 3, 11, "i2").vline(47, 36, 11, "s1");
  p.hline(25, 33, 25, "i2").hline(25, 32, 25, "s1");
  // antenne avec balise clignotante
  p.vline(73, 19, 29, "s2").vline(74, 19, 29, "i1");
  p.hline(70, 26, 8, "s2").hline(71, 31, 6, "s1");
  p.set(73, 18, "mgL").set(74, 18, "mgD");
  shadowUnder(p, 71, 48, 6);
}

function roofCalcul(p: Pix, R: Ramp): void {
  // parabole
  p.rect(26, 43, 8, 4, "i2").hline(26, 43, 8, "s1").hline(26, 46, 8, "n3");
  p.vline(29, 34, 10, "s1").vline(30, 34, 10, "i1");
  p.ellipse(29.5, 28, 14, 11, "s1");
  p.ellipse(29.5, 28.5, 12.5, 9.5, "i2");
  p.ellipse(30, 29, 10.5, 7.5, "n3");
  p.dither(18, 21, 22, 14, "s1", 3);
  p.line(29, 28, 38, 20, "s2");
  p.rect(37, 19, 3, 3, R.m).set(38, 20, R.W);
  p.hline(16, 28, 27, "i1");
  p.vline(29, 18, 20, "i1");
  shadowUnder(p, 24, 47, 12);
  // cheminées d'échappement
  for (const x of [54, 64]) {
    p.rect(x, 26, 6, 22, "i2").vline(x, 26, 22, "s1").vline(x + 5, 26, 22, "n3");
    for (const y of [30, 38]) p.hline(x, y, 6, "n3").hline(x, y + 1, 6, "s1");
    p.rect(x - 1, 24, 8, 3, "s1").hline(x - 1, 24, 8, "s2").hline(x - 1, 26, 8, "n3");
    p.rect(x + 1, 25, 4, 1, R.D).hline(x - 1, 46, 8, "n3");
    shadowUnder(p, x - 1, 48, 9);
  }
  // conteneur serveur
  box(p, 4, 48, 14, 9, 4, { top: "i2", hi: "s1", front: "i1", shade: "n3" });
  for (let k = 0; k < 4; k++) p.set(6 + k * 3, 42, k % 2 ? R.L : "grL");
  p.hline(5, 44, 11, "n3");
  shadowUnder(p, 4, 48, 15);
}

function roofIntuition(p: Pix, R: Ramp): void {
  // observatoire : coupole nervurée avec une fente éclairée
  const cx = 26;
  const by = 47;
  const d = new Pix(BW, BH);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      if (!inEllipse(x, y, cx, by - 3, 17, 18) || y > by - 4) continue;
      const k = (x - cx) / 17;
      d.set(x, y, k < -0.4 ? "s1" : k > 0.45 ? "n3" : "i2");
    }
  for (const k of [-11, -5, 5, 11]) {
    const top = Math.round(by - 4 - Math.sqrt(Math.max(0, 1 - (k * k) / 289)) * 17);
    d.line(cx + k, by - 4, cx + Math.round(k * 0.5), top + 1, "n3");
  }
  d.dither(cx - 15, by - 21, 31, 6, "s2", 3);
  d.rect(cx - 3, by - 22, 6, 19, "ink").rect(cx - 2, by - 22, 4, 19, "amD");
  d.dither(cx - 2, by - 22, 4, 19, "am", 7).dither(cx - 2, by - 14, 4, 11, "amL", 6);
  d.vline(cx - 3, by - 22, 19, "s2");
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) if (d.get(x, y) && !inEllipse(x, y, cx, by - 3, 17.5, 18.5)) d.clear(x, y);
  p.blit(d, 0, 0);
  p.rect(cx - 18, by - 3, 37, 5, "s1").hline(cx - 18, by - 3, 37, "s2").hline(cx - 18, by + 1, 37, "n3");
  // télescope
  p.line(cx + 1, by - 12, cx + 15, by - 27, "s2").line(cx + 2, by - 12, cx + 16, by - 26, "i2").line(cx + 3, by - 12, cx + 17, by - 25, "n3");
  p.rect(cx + 15, by - 28, 4, 3, "s1").set(cx + 17, by - 28, "amL");
  shadowUnder(p, cx - 16, by + 2, 36);
  // château d'eau
  p.rect(58, 28, 15, 11, "rust").vline(58, 28, 11, "i2").vline(72, 28, 11, "ink");
  p.hline(58, 28, 15, "i2").hline(58, 33, 15, "amD").hline(58, 38, 15, "n1");
  p.rect(60, 25, 11, 3, "amD").hline(60, 25, 11, "am").hline(62, 23, 7, "amD");
  p.dither(58, 29, 15, 9, "amD", 3);
  for (const x of [59, 71]) p.vline(x, 39, 8, "i2").vline(x + 1, 39, 8, "n3");
  p.line(60, 40, 70, 46, "n3").line(70, 40, 60, 46, "n3");
  p.hline(57, 47, 17, "n3");
  shadowUnder(p, 57, 47, 18);
  p.set(76, 30, R.W);
}

// ── Façades ──────────────────────────────────────────────────

function facade(p: Pix, id: BuildingId, R: Ramp): void {
  switch (id) {
    case "savoir":
      archWindow(p, WIN_L, R, 3);
      archWindow(p, WIN_R, R, 8);
      door(p, R, true);
      // bannière
      p.rect(26, FAC_Y + 4, 1, 1, "s2");
      break;
    case "archives":
      drawerPanel(p, WIN_L, R);
      drawerPanel(p, WIN_R, R);
      door(p, R, false);
      break;
    case "calcul":
      ribbonWindow(p, WIN_L, R, 5);
      ribbonWindow(p, WIN_R, R, 6);
      door(p, R, false);
      // bande de danger sur la plinthe
      for (let x = 4; x < 76; x++) if (((x + 2) >> 2) % 2 === 0) p.hline(x, BH - 3, 1, "amD").hline(x, BH - 2, 1, "am");
      break;
    case "intuition":
      roundWindow(p, WIN_L, R);
      roundWindow(p, WIN_R, R);
      door(p, R, true);
      // lanternes de part et d'autre de la porte
      for (const lx of [27, 52]) {
        p.vline(lx, 82, 3, "s1").rect(lx - 1, 85, 3, 4, "amD").rect(lx, 86, 1, 2, "amL").set(lx, 85, "amL");
      }
      break;
  }
  awning(p, R);
}

const ROOFS: Record<BuildingId, (p: Pix, R: Ramp) => void> = {
  savoir: roofSavoir,
  archives: roofArchives,
  calcul: roofCalcul,
  intuition: roofIntuition,
};

export interface BuildingArt {
  id: BuildingId;
  tone: Tone;
  /** Sprite avec enseigne allumée / éteinte (grésillement). */
  on: Pix;
  off: Pix;
  /** L'enseigne seule, allumée (pour les reflets au sol). */
  signOn: Pix;
}

function build(id: BuildingId, lit: boolean): Pix {
  const tone = TONES[id];
  const R = RAMP[tone];
  const p = new Pix(BW, BH);
  const seed = { savoir: 101, archives: 202, calcul: 303, intuition: 404 }[id];
  roofSurface(p, R, seed);
  brickWall(p, R, seed + 1);
  facade(p, id, R);
  sign(p, id, R, lit);
  ROOFS[id](p, R);
  // liseré lumineux des arêtes : la silhouette reçoit la lumière du dessus
  p.hline(0, ROOF_Y, BW, "s2");
  return p;
}

export function makeBuilding(id: BuildingId): BuildingArt {
  const on = build(id, true);
  const off = build(id, false);
  return { id, tone: TONES[id], on, off, signOn: on.crop(SIGN.x - 1, SIGN.y - 1, SIGN.w + 2, SIGN.h + 2) };
}

export const BUILDING_IDS: BuildingId[] = ["savoir", "archives", "calcul", "intuition"];
