import { Pix, rng } from "./pix";

export const T = 16;
const tile = () => new Pix(T, T);

/** Asphalte : fond sombre grenu, quelques fissures. */
function asphalt(seed: number, cracks: number): Pix {
  const p = tile().rect(0, 0, T, T, "n2");
  const r = rng(seed);
  p.scatter(0, 0, T, T, "n3", 0.1, r).scatter(0, 0, T, T, "n1", 0.08, r).scatter(0, 0, T, T, "i1", 0.025, r);
  for (let k = 0; k < cracks; k++) {
    let x = Math.floor(r() * T);
    let y = Math.floor(r() * T);
    for (let s = 0; s < 6 + Math.floor(r() * 5); s++) {
      p.set(x, y, "ink");
      if (r() < 0.4) p.set(x + 1, y, "n1");
      x += r() < 0.5 ? 1 : 0;
      y += r() < 0.6 ? 1 : 0;
      x = (x + T) % T;
      y = (y + T) % T;
    }
  }
  return p;
}

/** Dalles de trottoir : damier de dalles 8×8 teintées, joints sombres, arête haute éclairée. */
function pavement(seed: number, bond: boolean): Pix {
  const p = tile();
  const r = rng(seed);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const row = y >> 3;
      const off = bond ? (row % 2) * 4 : 0;
      const sx = ((x + off) % T) >> 3;
      const base = (sx + row) % 2 === 0 ? "i1" : "i2";
      const lx = (x + off) % 8;
      const ly = y % 8;
      if (lx === 7 || ly === 7) p.set(x, y, "n3");
      else if (ly === 0) p.set(x, y, bayer4(x, y) < 9 ? "s1" : base);
      else if (lx === 0) p.set(x, y, bayer4(x, y) < 4 ? "s1" : base);
      else p.set(x, y, base);
    }
  p.scatter(0, 0, T, T, "n3", 0.04, r).scatter(0, 0, T, T, "s1", 0.03, r);
  return p;
}
const bayer4 = (x: number, y: number) => [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((y & 3) << 2) | (x & 3)];

function plaza(inverted: boolean, seed: number): Pix {
  const p = tile();
  const r = rng(seed);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      const dark = ((x >> 3) + (y >> 3) + (inverted ? 1 : 0)) % 2 === 0;
      const lx = x % 8;
      const ly = y % 8;
      let c = dark ? "n3" : "i1";
      if (lx === 7 || ly === 7) c = "n2";
      else if (ly === 0) c = dark ? "i1" : "i2";
      else if (lx === 0) c = bayer4(x, y) < 8 ? (dark ? "i1" : "i2") : c;
      p.set(x, y, c as "n3");
    }
  p.scatter(0, 0, T, T, "n2", 0.05, r).scatter(0, 0, T, T, "s1", 0.015, r);
  return p;
}

/** Place à circuit : lignes cyan éteintes qui rappellent le Portail. */
function plazaCircuit(): Pix {
  const p = plaza(false, 31);
  p.hline(0, 4, 10, "cyD").vline(9, 4, 9, "cyD").hline(9, 12, 7, "cyD");
  p.hline(0, 11, 5, "v1").vline(4, 11, 5, "v1");
  p.rect(9, 3, 2, 2, "cy").rect(8, 11, 2, 2, "cy").rect(3, 10, 2, 2, "v2");
  p.set(9, 3, "cyL").set(8, 11, "cyL").set(3, 10, "v3");
  p.dither(7, 2, 6, 4, "cyD", 4).dither(6, 10, 6, 5, "cyD", 3);
  return p;
}

/** Ligne centrale pointillée, usée. */
function roadDash(): Pix {
  const p = asphalt(11, 0);
  p.hline(2, 7, 11, "am").hline(2, 8, 11, "amD");
  p.set(2, 7, "amD").set(12, 7, "amD");
  p.scatter(2, 7, 11, 2, "n2", 0.18, rng(5));
  return p;
}

/** Passage piéton : deux bandes parallèles à la route, peinture écaillée. */
function crosswalk(): Pix {
  const p = asphalt(23, 0);
  const r = rng(77);
  for (const y0 of [1, 9])
    for (let y = y0; y < y0 + 4; y++)
      for (let x = 0; x < T; x++) {
        if (r() < 0.07) continue;
        p.set(x, y, y === y0 ? "s2" : y === y0 + 3 ? "i2" : "s1");
      }
  return p;
}

/** Bordure : trottoir au nord, route au sud. On voit la face de la bordure. */
function curbSouth(): Pix {
  const p = pavement(41, false);
  for (let y = 9; y < T; y++) for (let x = 0; x < T; x++) p.clear(x, y);
  p.hline(0, 9, T, "s2");
  p.rect(0, 10, T, 2, "i2");
  p.hline(0, 12, T, "i1");
  for (const x of [3, 11]) p.vline(x, 10, 3, "n3");
  p.hline(0, 10, T, "s1").dither(0, 10, T, 1, "i2", 8);
  p.hline(0, 13, T, "ink");
  const a = asphalt(9, 0);
  for (let y = 14; y < T; y++) for (let x = 0; x < T; x++) p.buf[y * T + x] = a.buf[y * T + x];
  p.dither(0, 14, T, 1, "n1", 8);
  return p;
}

/** Bordure : route au nord, trottoir au sud (arête éclairée seulement). */
function curbNorth(): Pix {
  const p = pavement(43, true);
  const a = asphalt(15, 0);
  for (let y = 0; y < 2; y++) for (let x = 0; x < T; x++) p.buf[y * T + x] = a.buf[y * T + x];
  p.hline(0, 2, T, "ink").hline(0, 3, T, "s2");
  p.hline(0, 4, T, "i2").dither(0, 4, T, 1, "s1", 6);
  return p;
}

function manhole(): Pix {
  const p = asphalt(19, 1);
  p.ellipse(8, 8, 6.5, 6.5, "n1").ellipse(8, 8, 5.5, 5.5, "i1").ellipse(8, 8, 4.6, 4.6, "n3");
  for (let i = -3; i <= 3; i += 2) {
    p.hline(4, 8 + i, 8, "n1");
  }
  p.vline(8, 4, 8, "n1");
  p.set(5, 5, "s1").set(6, 4, "s1").set(4, 6, "s1").set(10, 4, "i2").set(11, 5, "i2");
  return p;
}

function grate(): Pix {
  const p = pavement(53, false);
  p.rect(3, 6, 10, 5, "ink").frame(2, 5, 12, 7, "s1");
  for (let x = 4; x < 13; x += 2) p.vline(x, 6, 5, "i2");
  p.hline(2, 12, 12, "n1");
  return p;
}

/** Gravier de ruelle : plus sombre, un peu de rouille. */
function gravel(seed: number): Pix {
  const p = tile().rect(0, 0, T, T, "n1");
  const r = rng(seed);
  p.scatter(0, 0, T, T, "n2", 0.22, r).scatter(0, 0, T, T, "n3", 0.1, r).scatter(0, 0, T, T, "rust", 0.05, r).scatter(0, 0, T, T, "i1", 0.025, r);
  p.scatter(0, 0, T, T, "ink", 0.06, r);
  return p;
}

/** Flaque : calque transparent, reflets ajoutés par la scène. */
function puddle(kind: 0 | 1): Pix {
  const p = tile();
  const shapes = kind === 0 ? [[8, 8, 7, 3.6], [5, 7, 4, 2.4]] : [[8, 9, 6, 3], [11, 8, 4, 2.6], [4, 9, 3, 2]];
  for (const [cx, cy, rx, ry] of shapes) p.ellipse(cx, cy, rx, ry, "n1");
  // rive plus claire sur l'arête haute (le ciel s'y reflète)
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      if (!p.get(x, y)) continue;
      if (!p.get(x, y - 1)) p.set(x, y, "i1");
      else if (!p.get(x - 1, y) || !p.get(x + 1, y)) p.set(x, y, "n2");
    }
  p.hline(kind === 0 ? 4 : 5, 7, 3, "n3").hline(10, 9, 2, "n3");
  p.set(6, 6, "s1").set(11, 8, "s1");
  return p;
}

/** Caniveau avec filet d'eau (haut de rue). */
function gutter(): Pix {
  const p = asphalt(61, 0);
  p.hline(0, 12, T, "n1").hline(0, 13, T, "ink").hline(0, 14, T, "n1");
  p.dither(0, 13, T, 1, "i1", 4);
  return p;
}

export interface GroundSet {
  [k: string]: Pix;
}

export function makeGround(): GroundSet {
  return {
    "asphalt-a": asphalt(1, 0),
    "asphalt-b": asphalt(2, 1),
    "asphalt-c": asphalt(3, 2),
    "road-dash": roadDash(),
    crosswalk: crosswalk(),
    "curb-s": curbSouth(),
    "curb-n": curbNorth(),
    "pave-a": pavement(7, false),
    "pave-b": pavement(8, true),
    "plaza-a": plaza(false, 12),
    "plaza-b": plaza(true, 13),
    "plaza-circuit": plazaCircuit(),
    manhole: manhole(),
    grate: grate(),
    gutter: gutter(),
    gravel: gravel(21),
    "puddle-a": puddle(0),
    "puddle-b": puddle(1),
  };
}
