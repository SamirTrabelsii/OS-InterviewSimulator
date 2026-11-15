import type { Col } from "./palette";
import { getArt } from "./index";
import { Pix, rng } from "./pix";
import { makeSkyline } from "./skyline";

/**
 * Décors d'intérieur des épreuves (et l'extérieur nocturne des pages hors épreuve) : un tableau fixe de 320 × 180 par bâtiment
 * (Savoir, Archives, Calcul, Intuition) et un pour le Portail. Même palette
 * que le quartier. Volontairement sombres et rangés sur les bords : la
 * zone de travail (énoncé, éditeur) reste posée dessus, sur des surfaces unies.
 */
export const IW = 320;
export const IH = 180;
export type InteriorId = "savoir" | "archives" | "calcul" | "intuition" | "portail" | "quartier";
export const INTERIOR_IDS: InteriorId[] = ["savoir", "archives", "calcul", "intuition", "portail", "quartier"];

const FLOOR_Y = 138;

/** Mur sombre à fines rayures tramées, plinthe et sol en lames. */
function room(p: Pix, wall: Col, wallHi: Col, accent: Col): void {
  p.rect(0, 0, IW, FLOOR_Y, wall);
  for (let x = 0; x < IW; x += 16) p.dither(x, 0, 1, FLOOR_Y, wallHi, 6);
  p.dither(0, 0, IW, 28, "ink", 7);
  p.hline(0, FLOOR_Y - 3, IW, "i1").rect(0, FLOOR_Y - 2, IW, 2, "n3");
  p.rect(0, FLOOR_Y, IW, IH - FLOOR_Y, "n2");
  for (let y = FLOOR_Y + 6; y < IH; y += 8) p.hline(0, y, IW, "n1");
  for (let x = 0; x < IW; x += 24) for (let y = FLOOR_Y; y < IH; y += 8) p.vline(x + ((y >> 3) % 2) * 12, y, 8, "n1");
  p.hline(0, FLOOR_Y, IW, accent === "ink" ? "i1" : "i1");
  p.dither(0, FLOOR_Y + 1, IW, 6, accent, 2);
}

/** Les deux flancs seulement : on dessine à gauche et on reflète à droite quand `mirror`. */
const sides = (draw: (x0: number, dir: 1 | -1) => void) => {
  draw(0, 1);
  draw(IW, -1);
};
const at = (x0: number, dir: 1 | -1, x: number, w: number) => (dir === 1 ? x0 + x : x0 - x - w);

function savoir(p: Pix): void {
  const r = rng(11);
  room(p, "n1", "n2", "cyD");
  const books: Col[] = ["v1", "cyD", "i2", "mgD", "amD", "s1", "plum"];
  sides((x0, dir) => {
    for (let b = 0; b < 2; b++) {
      const w = 52;
      const bx = at(x0, dir, 6 + b * 58, w);
      p.rect(bx, 20, w, FLOOR_Y - 22, "n3").frame(bx, 20, w, FLOOR_Y - 22, "i1");
      for (let s = 0; s < 5; s++) {
        const sy = 24 + s * 22;
        p.rect(bx + 2, sy, w - 4, 20, "ink");
        let x = bx + 3;
        while (x < bx + w - 6) {
          const bw = 2 + Math.floor(r() * 3);
          const bh = 10 + Math.floor(r() * 9);
          const c = books[Math.floor(r() * books.length)];
          p.rect(x, sy + 20 - bh, bw, bh, c).vline(x, sy + 20 - bh, bh, "i2");
          if (r() < 0.12) p.set(x + 1, sy + 20 - bh + 2, "cyL");
          x += bw + (r() < 0.2 ? 2 : 0);
        }
        p.hline(bx + 1, sy + 20, w - 2, "i2");
      }
    }
  });
  // lampe de lecture et fenêtre étoilée au centre haut
  p.rect(150, 10, 20, 24, "ink").frame(150, 10, 20, 24, "i2").vline(159, 10, 24, "i2").hline(150, 22, 20, "i2");
  for (const [x, y] of [[153, 14], [164, 17], [155, 27], [166, 29]]) p.set(x, y, "cyW");
  p.rect(188, 6, 1, 10, "i2").rect(184, 16, 9, 4, "amD").hline(185, 19, 7, "amL");
}

function archives(p: Pix): void {
  const r = rng(23);
  room(p, "n1", "n2", "grD");
  sides((x0, dir) => {
    // baies de serveurs
    for (let k = 0; k < 3; k++) {
      const w = 30;
      const bx = at(x0, dir, 6 + k * 34, w);
      p.rect(bx, 34, w, FLOOR_Y - 36, "n3").frame(bx, 34, w, FLOOR_Y - 36, "i1");
      for (let u = 0; u < 9; u++) {
        const y = 38 + u * 11;
        p.rect(bx + 3, y, w - 6, 9, "ink").hline(bx + 3, y, w - 6, "i1");
        for (let l = 0; l < 4; l++) {
          const on = r();
          p.set(bx + 5 + l * 3, y + 4, on < 0.5 ? "gr" : on < 0.65 ? "am" : "grD");
        }
        p.rect(bx + w - 12, y + 3, 7, 3, "n2");
      }
    }
  });
  // tuyaux et câbles au plafond, étiquettes
  p.rect(0, 8, IW, 3, "i1").hline(0, 8, IW, "i2");
  for (let x = 10; x < IW; x += 40) p.rect(x, 11, 2, 5, "i1");
  for (let x = 120; x < 200; x += 10) p.rect(x, 16, 1, 20 + ((x * 7) % 12), "grD");
  p.rect(140, 50, 40, 16, "n3").frame(140, 50, 40, 16, "i1").hline(144, 56, 32, "grD").hline(144, 60, 24, "grD");
}

/** Engrenage : disque, dents et moyeu. */
function gear(p: Pix, cx: number, cy: number, r: number, body: Col, tooth: Col): void {
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    p.rect(Math.round(cx + Math.cos(ang) * (r + 1)) - 1, Math.round(cy + Math.sin(ang) * (r + 1)) - 1, 3, 3, tooth);
  }
  p.ellipse(cx, cy, r, r, body).ellipse(cx, cy, r * 0.55, r * 0.55, "ink").ellipse(cx, cy, 1.5, 1.5, tooth);
}

function calcul(p: Pix): void {
  const r = rng(37);
  room(p, "n1", "plum", "mgD");
  // pistes de circuit : traits horizontaux et verticaux, nœuds
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0;
    const x = side ? 4 + Math.floor(r() * 70) : IW - 74 + Math.floor(r() * 70);
    const y = 18 + Math.floor(r() * 110);
    const len = 12 + Math.floor(r() * 36);
    if (r() < 0.5) p.hline(x, y, len, "mgD").set(x + len, y, "mg");
    else p.vline(x, y, Math.min(len, FLOOR_Y - 6 - y), "mgD").set(x, y, "mg");
  }
  sides((x0, dir) => {
    gear(p, at(x0, dir, 30, 0), 48, 18, "plum", "mgD");
    gear(p, at(x0, dir, 62, 0), 90, 11, "n3", "mgD");
    gear(p, at(x0, dir, 24, 0), 110, 8, "n3", "mgD");
    // module de calcul au sol
    const bx = at(x0, dir, 8, 40);
    p.rect(bx, 116, 40, 20, "n3").frame(bx, 116, 40, 20, "i1");
    p.rect(bx + 4, 120, 18, 12, "ink").hline(bx + 6, 124, 12, "mgD").hline(bx + 6, 128, 8, "mgD").set(bx + 15, 128, "mgL");
    for (let l = 0; l < 3; l++) p.set(bx + 28 + l * 3, 123, l === 1 ? "mg" : "i2");
  });
  p.rect(146, 12, 28, 18, "ink").frame(146, 12, 28, 18, "i2").hline(150, 18, 14, "mgD").hline(150, 22, 20, "mgD");
}

function intuition(p: Pix): void {
  const r = rng(51);
  room(p, "n1", "n2", "amD");
  // guirlande d'ampoules au plafond
  const cols: Col[] = ["am", "mgD", "cyD", "amD", "grD"];
  for (let x = 0; x < IW; x += 2) {
    const y = 14 + Math.round(Math.sin((x / IW) * Math.PI * 5) * 4);
    p.set(x, y, "i1");
    if (x % 22 === 0) p.rect(x, y + 1, 2, 3, cols[(x / 22) % cols.length]).set(x, y + 4, "n3");
  }
  sides((x0, dir) => {
    // fenêtres en arc sur la nuit
    for (let k = 0; k < 2; k++) {
      const w = 26;
      const bx = at(x0, dir, 10 + k * 36, w);
      p.rect(bx, 40, w, 64, "ink").ellipse(bx + w / 2, 40, w / 2, 8, "ink");
      p.frame(bx, 40, w, 64, "i1").vline(bx + w / 2, 40, 64, "i1").hline(bx, 72, w, "i1");
      for (let s = 0; s < 6; s++) p.set(bx + 3 + Math.floor(r() * (w - 6)), 36 + Math.floor(r() * 60), s % 2 ? "amL" : "mist");
      p.rect(bx - 2, 104, w + 4, 3, "i2");
    }
    // bougies et cadenas posés au sol
    const cx = at(x0, dir, 12, 0);
    p.rect(cx, 126, 3, 8, "skin").set(cx + 1, 124, "amL").set(cx + 1, 125, "am");
    p.rect(cx + 14, 122, 12, 11, "amD").frame(cx + 14, 122, 12, 11, "am").set(cx + 19, 127, "ink").set(cx + 20, 127, "ink");
    p.ellipse(cx + 20, 120, 4, 4, "amD").ellipse(cx + 20, 121, 2, 2, "n1");
  });
  // grande horloge au centre haut
  p.ellipse(160, 30, 13, 13, "i1").ellipse(160, 30, 11, 11, "ink").vline(160, 22, 8, "amL").hline(160, 30, 6, "am");
}

function portail(p: Pix): void {
  const r = rng(67);
  room(p, "n1", "n2", "v1");
  sides((x0, dir) => {
    // piliers à runes
    for (let k = 0; k < 2; k++) {
      const w = 22;
      const bx = at(x0, dir, 10 + k * 30, w);
      p.rect(bx, 12, w, FLOOR_Y - 12, "n3").frame(bx, 12, w, FLOOR_Y - 12, "i1");
      p.rect(bx, 12, w, 5, "i1").rect(bx, FLOOR_Y - 8, w, 8, "i1");
      for (let y = 24; y < FLOOR_Y - 14; y += 10) {
        const lit = r() < 0.35;
        p.rect(bx + 6, y, 10, 6, "ink");
        p.set(bx + 8, y + 1, lit ? "cyL" : "v1").set(bx + 11, y + 3, lit ? "v3" : "v1").set(bx + 13, y + 2, lit ? "cyW" : "v1").vline(bx + 9, y, 6, lit ? "v2" : "i2");
      }
    }
  });
  // anneau au sol et conduits
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    p.set(Math.round(160 + Math.cos(ang) * 56), Math.round(160 + Math.sin(ang) * 14), a % 8 === 0 ? "cyL" : "v1");
  }
  p.rect(0, 6, IW, 3, "i1");
  for (let x = 20; x < IW; x += 36) p.vline(x, 9, 6, "v1").set(x, 15, "v3");
}

/** Le quartier vu de la rue, de nuit : ciel, lune, toits, rue mouillée et deux lampadaires (accueil, fin, erreurs). */
function quartier(p: Pix): void {
  p.blit(makeSkyline(IW, 100), 0, 0);
  p.rect(0, 100, IW, IH - 100, "n2").hline(0, 100, IW, "i2").rect(0, 101, IW, 3, "i1").hline(0, 104, IW, "n3");
  p.dither(0, 105, IW, 20, "n1", 5);
  for (let y = 124; y < IH; y += 12) for (let x = ((y / 12) % 2) * 20; x < IW; x += 40) p.hline(x, y, 20, "n3");
  p.dither(0, 140, IW, 40, "ink", 4);
  const lamp = getArt().props.lamp;
  for (const x of [28, 276]) {
    p.dither(x - 12, 62, 40, 42, "amD", 1);
    p.blit(lamp, x, 56);
    p.ellipse(x + 8, 110, 12, 2.5, "amD");
  }
}

const DRAW: Record<InteriorId, (p: Pix) => void> = { savoir, archives, calcul, intuition, portail, quartier };
const cache = new Map<InteriorId, Pix>();

/** Décor d'un bâtiment (ou du Portail), généré une seule fois. */
export function makeInterior(id: InteriorId): Pix {
  let p = cache.get(id);
  if (!p) {
    p = new Pix(IW, IH);
    DRAW[id](p);
    cache.set(id, p);
  }
  return p;
}
