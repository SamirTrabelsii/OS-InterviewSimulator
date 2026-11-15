import type { Col } from "./palette";
import { Pix, rng } from "./pix";
import { drawText, textWidth } from "./font";

/**
 * Boîte en 3/4 : face avant + dessus éclairé + arête. Sert aux caisses, climatiseurs,
 * distributeurs… (x, yBase = bas de la face avant).
 */
export function box(p: Pix, x: number, yBase: number, w: number, h: number, d: number, c: { top: Col; hi: Col; front: Col; shade: Col }): void {
  p.rect(x, yBase - h, w, h, c.front);
  p.vline(x, yBase - h, h, c.hi);
  p.vline(x + w - 1, yBase - h, h, c.shade);
  p.hline(x, yBase - 1, w, c.shade);
  p.rect(x, yBase - h - d, w, d, c.top);
  p.hline(x, yBase - h - d, w, c.hi);
  p.hline(x, yBase - h, w, c.hi);
}

/** Lampadaire : 16 × 48, la lumière sort de (LAMP_LIGHT). */
export const LAMP_LIGHT = { x: 12, y: 9 };
function lamp(): Pix {
  const p = new Pix(16, 48);
  p.rect(5, 45, 6, 2, "i2").hline(5, 45, 6, "s1").hline(6, 47, 4, "n3");
  p.rect(6, 41, 4, 4, "i1").hline(6, 41, 4, "i2");
  p.rect(7, 9, 2, 33, "i2").vline(7, 9, 33, "s2").vline(8, 9, 33, "i1");
  for (const y of [18, 28, 38]) p.rect(6, y, 4, 2, "s1").hline(6, y + 1, 4, "i1");
  // bras
  p.rect(7, 6, 6, 3, "i2").hline(7, 6, 6, "s2").hline(7, 8, 6, "i1");
  p.rect(6, 7, 2, 3, "i2");
  // tête
  p.rect(10, 4, 6, 4, "i2").hline(10, 4, 6, "s2").hline(10, 7, 6, "n3");
  p.rect(10, 8, 6, 1, "amD").rect(11, 8, 4, 1, "amL");
  p.set(10, 4, "s1").set(15, 4, "i1");
  return p.outline();
}

function bench(): Pix {
  const p = new Pix(32, 16);
  // dossier : trois lattes
  for (let i = 0; i < 3; i++) {
    p.rect(1, 1 + i * 2, 30, 2, "rust").hline(1, 1 + i * 2, 30, "i2");
  }
  p.vline(1, 1, 6, "s1").hline(1, 1, 30, "s1");
  // assise (vue de dessus)
  p.rect(0, 8, 32, 3, "i2").hline(0, 8, 32, "s2").hline(0, 10, 32, "i1");
  p.rect(0, 11, 32, 1, "n3");
  // pieds
  for (const x of [2, 27]) {
    p.rect(x, 12, 3, 4, "i1").vline(x, 12, 4, "s1");
    p.hline(x, 15, 3, "n1");
  }
  p.hline(4, 12, 24, "n2");
  // liseré néon sous l'assise
  p.hline(4, 12, 24, "cyD").dither(4, 12, 24, 1, "cy", 3);
  return p.outline();
}

/** Distributeur : 16 × 32, enseigne et rayons éclairés. `tone` : couleur de l'enseigne. */
function vending(tone: "mg" | "cy"): Pix {
  const L = tone === "mg" ? { m: "mg", l: "mgL", w: "mgW", d: "mgD" } : { m: "cy", l: "cyL", w: "cyW", d: "cyD" };
  const p = new Pix(16, 32);
  p.rect(0, 4, 16, 28, "i2").vline(0, 4, 28, "s1").vline(15, 4, 28, "n3").hline(0, 31, 16, "n2");
  p.rect(0, 0, 16, 5, "i1").hline(0, 0, 16, "s1").hline(0, 4, 16, "n3");
  // enseigne
  p.rect(2, 1, 12, 3, "ink").hline(3, 2, 10, L.l as Col).dither(3, 3, 10, 1, L.m as Col, 8);
  // vitrine
  p.rect(2, 6, 9, 15, "ink");
  const items: Col[] = ["am", "cyL", "mgL", "grL", "amL", "v3"];
  const r = rng(tone === "mg" ? 4 : 9);
  for (let row = 0; row < 3; row++) {
    p.hline(2, 8 + row * 5, 9, "i1");
    for (let col = 0; col < 3; col++) {
      const c = items[Math.floor(r() * items.length)];
      p.rect(3 + col * 3, 6 + row * 5 + 1, 2, 3, c).set(3 + col * 3, 6 + row * 5 + 1, "moon");
    }
  }
  p.dither(2, 6, 9, 15, L.d as Col, 2);
  // panneau latéral : boutons et fente
  p.rect(12, 7, 3, 6, "n3");
  for (let i = 0; i < 3; i++) p.set(13, 8 + i * 2, i === 1 ? "grL" : "s2");
  p.rect(12, 15, 3, 2, "ink").rect(2, 23, 9, 4, "ink").hline(3, 24, 7, "n3");
  p.rect(12, 19, 3, 5, "n3").set(13, 20, "am");
  p.hline(0, 28, 16, "i1");
  return p.outline();
}

function plant(): Pix {
  const p = new Pix(16, 24);
  // feuilles
  const leaf = (cx: number, cy: number, rx: number, ry: number) => {
    p.ellipse(cx, cy, rx, ry, "grD");
    p.ellipse(cx - 0.5, cy - 0.7, rx - 1, ry - 1, "gr");
  };
  leaf(8, 7, 5, 6);
  leaf(4, 11, 4, 4);
  leaf(12, 11, 4, 4);
  leaf(8, 12, 4, 3);
  p.rect(7, 2, 1, 2, "grL").rect(3, 9, 1, 2, "grL").rect(11, 8, 2, 1, "grL").rect(6, 5, 2, 1, "grL");
  p.set(8, 3, "mgL").set(9, 3, "mgL").set(8, 4, "mgW"); // une fleur
  // pot
  p.rect(4, 15, 8, 7, "rust").hline(3, 15, 10, "i2").hline(3, 16, 10, "i1");
  p.vline(4, 17, 5, "i2").vline(11, 17, 5, "n1").hline(5, 22, 6, "n1");
  p.dither(4, 17, 8, 5, "n1", 3);
  return p.outline();
}

function crate(): Pix {
  const p = new Pix(16, 18);
  box(p, 0, 17, 16, 13, 4, { top: "amD", hi: "am", front: "rust", shade: "n1" });
  // lattes
  p.hline(1, 8, 14, "n1").hline(1, 12, 14, "n1");
  p.vline(1, 5, 12, "amD").vline(14, 5, 12, "amD");
  p.line(2, 9, 13, 15, "n1");
  p.dither(1, 4, 14, 12, "amD", 2);
  p.set(2, 5, "am").set(13, 5, "am").set(2, 15, "am").set(13, 15, "n1");
  return p.outline();
}

function crateStack(): Pix {
  const p = new Pix(16, 30);
  p.blit(crate(), 0, 12);
  const small = new Pix(12, 14);
  box(small, 0, 13, 12, 10, 3, { top: "i1", hi: "s1", front: "i2", shade: "n3" });
  small.hline(1, 8, 10, "n3").vline(5, 3, 10, "n3");
  small.rect(8, 6, 3, 2, "mgD").set(9, 6, "mgL"); // étiquette
  p.blit(small.outline(), 2, 0);
  return p;
}

function dumpster(): Pix {
  const p = new Pix(32, 24);
  // couvercle : dessus
  p.rect(0, 0, 32, 7, "grD").hline(0, 0, 32, "gr").hline(0, 6, 32, "i1");
  p.rect(1, 1, 30, 5, "n3").hline(1, 1, 30, "i2");
  p.dither(1, 2, 30, 4, "grD", 5);
  p.rect(14, 2, 4, 1, "s1");
  // face avant : bennes nervurées
  p.rect(0, 7, 32, 14, "grD").vline(0, 7, 14, "gr").vline(31, 7, 14, "n3");
  for (let x = 4; x < 31; x += 5) p.vline(x, 8, 12, "n1").vline(x + 1, 8, 12, "gr");
  p.hline(0, 7, 32, "gr").hline(0, 20, 32, "n1");
  p.dither(0, 7, 32, 14, "n1", 4);
  // graffiti
  p.hline(8, 12, 6, "mgL").set(8, 13, "mgL").hline(8, 14, 5, "mgL").set(12, 15, "mgL").hline(8, 16, 5, "mgL").dither(7, 11, 8, 7, "mgD", 3);
  p.set(21, 12, "cyL").set(22, 13, "cyL").set(23, 12, "cyL").set(22, 14, "cyL");
  // roues
  for (const x of [3, 25]) p.rect(x, 21, 4, 3, "ink").hline(x, 21, 4, "i1");
  return p.outline();
}

function bin(): Pix {
  const p = new Pix(12, 16);
  p.rect(1, 3, 10, 11, "i2").vline(1, 3, 11, "s1").vline(10, 3, 11, "n3");
  for (let y = 5; y < 13; y += 2) p.hline(2, y, 8, "n3");
  p.rect(0, 1, 12, 3, "i1").hline(0, 1, 12, "s2").hline(0, 3, 12, "n3");
  p.rect(4, 0, 4, 1, "s1");
  p.hline(1, 14, 10, "n1");
  p.set(8, 9, "cyL").set(3, 7, "mgL"); // un autocollant
  return p.outline();
}

/** Borne : 8 × 14 avec LED cyan en tête. */
function bollard(): Pix {
  const p = new Pix(8, 14);
  p.rect(1, 3, 6, 10, "i2").vline(1, 3, 10, "s1").vline(6, 3, 10, "n3");
  p.rect(1, 2, 6, 2, "i1").hline(1, 2, 6, "s2");
  p.rect(2, 1, 4, 1, "cyL").set(3, 0, "cyW").hline(2, 5, 4, "amD").hline(2, 6, 4, "am").hline(2, 7, 4, "amD");
  p.hline(0, 13, 8, "n1");
  return p.outline();
}

function hydrant(): Pix {
  const p = new Pix(10, 14);
  p.rect(2, 4, 6, 8, "mgD").vline(2, 4, 8, "mg").vline(7, 4, 8, "plum");
  p.rect(3, 1, 4, 3, "mgD").hline(3, 1, 4, "mg").hline(2, 4, 6, "mg");
  p.rect(0, 6, 2, 3, "mg").rect(8, 6, 2, 3, "mgD").set(0, 6, "mgL");
  p.rect(1, 12, 8, 2, "i2").hline(1, 12, 8, "s1");
  p.set(4, 5, "mgL");
  return p.outline();
}

/** Boîte aux lettres de rue / armoire électrique : 12 × 20. */
function cabinet(): Pix {
  const p = new Pix(14, 22);
  p.rect(0, 3, 14, 19, "i2").vline(0, 3, 19, "s1").vline(13, 3, 19, "n3");
  p.rect(0, 0, 14, 4, "i1").hline(0, 0, 14, "s2").hline(0, 3, 14, "n3");
  p.rect(2, 6, 10, 13, "n3").frame(2, 6, 10, 13, "i1");
  p.vline(7, 6, 13, "i1");
  p.rect(5, 12, 1, 3, "am").rect(8, 12, 1, 3, "am");
  p.set(3, 8, "grL").set(4, 8, "mgL").set(3, 17, "cyL");
  p.hline(0, 21, 14, "n1");
  return p.outline();
}

function neonBoard(): Pix {
  const label = "BIENVENUE";
  const w = textWidth(label) + 10;
  const p = new Pix(w, 18);
  p.rect(0, 0, w, 12, "ink").frame(0, 0, w, 12, "mgL");
  p.frame(1, 1, w - 2, 10, "mgD");
  p.dither(1, 1, w - 2, 10, "mgD", 2);
  drawText(p, 5, 3, label, "mgW");
  // pieds
  p.rect(5, 12, 2, 5, "i2").rect(w - 7, 12, 2, 5, "i2").vline(5, 12, 5, "s1").vline(w - 7, 12, 5, "s1");
  p.rect(2, 16, 8, 2, "i1").rect(w - 10, 16, 8, 2, "i1");
  return p;
}

/** Guirlande lumineuse : 7 ampoules sur un fil (le fil est tracé par la scène). */
export const BULB_COLORS: Col[] = ["am", "mgL", "cyL", "amL", "grL", "mgL", "cyL"];

export function makeProps(): Record<string, Pix> {
  return {
    lamp: lamp(),
    bench: bench(),
    "vending-mg": vending("mg"),
    "vending-cy": vending("cy"),
    plant: plant(),
    crate: crate(),
    "crate-stack": crateStack(),
    dumpster: dumpster(),
    bin: bin(),
    bollard: bollard(),
    hydrant: hydrant(),
    cabinet: cabinet(),
    "neon-board": neonBoard(),
  };
}
