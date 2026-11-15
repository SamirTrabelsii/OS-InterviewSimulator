import { Pix, bayer, rng } from "./pix";

/** Ciel nocturne et silhouettes lointaines : w × h (dessin pur, sans lumière). */
export function makeSkyline(w: number, h: number): Pix {
  const p = new Pix(w, h);
  const r = rng(2077);
  // dégradé du ciel : bandes tramées
  p.rect(0, 0, w, h, "ink");
  p.rect(0, 0, w, 14, "void");
  p.dither(0, 14, w, 10, "void", 8);
  p.dither(0, 36, w, 10, "n1", 5);
  p.dither(0, 46, w, h - 46, "n1", 11);
  // la lune, voilée
  const mx = Math.floor(w * 0.82);
  p.ellipse(mx, 17, 8, 8, "i1").ellipse(mx - 1, 16, 7, 7, "s1").ellipse(mx - 2, 15, 5.5, 5.5, "s2");
  p.set(mx + 1, 19, "i2").set(mx + 2, 19, "i2").set(mx - 1, 20, "i2").set(mx + 3, 14, "i2");
  p.dither(mx - 12, 6, 24, 22, "i1", 2);
  // deux plans de silhouettes
  for (const [depth, base, body, edge, hmin, hmax] of [
    [0, 62, "n1", "n2", 22, 44],
    [1, 70, "n2", "n3", 16, 34],
  ] as const) {
    let x = -4;
    while (x < w) {
      const bw = 10 + Math.floor(r() * 22);
      const bh = hmin + Math.floor(r() * (hmax - hmin));
      const top = base - bh;
      p.rect(x, top, bw, base - top, body);
      p.hline(x, top, bw, edge);
      p.vline(x, top, bh, edge);
      // fenêtres
      for (let wy = top + 3; wy < base - 2; wy += 4)
        for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
          const v = r();
          if (v < 0.13) p.set(wx, wy, depth ? "amD" : "cyD");
          else if (v < 0.17) p.set(wx, wy, "mgD");
          else if (v < 0.2) p.set(wx, wy, depth ? "am" : "cy");
          else if (v < 0.5) p.set(wx, wy, depth ? "n3" : "n2");
        }
      // antenne et balise
      if (r() < 0.4) {
        const ax = x + 2 + Math.floor(r() * (bw - 4));
        p.vline(ax, top - 6 - Math.floor(r() * 5), 7, edge);
        p.set(ax, top - 7, depth ? "mgD" : "mg");
      }
      // enseigne verticale
      if (depth === 0 && r() < 0.22 && bh > 30) {
        const sx = x + bw - 3;
        p.vline(sx, top + 4, 12, r() < 0.5 ? "mg" : "cy");
        p.vline(sx - 1, top + 4, 12, r() < 0.5 ? "mgD" : "cyD");
      }
      x += bw + Math.floor(r() * 3);
    }
  }
  // brume au ras des toits
  for (let y = 50; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < 3 && !p.get(x, y)) p.set(x, y, "n2");
  return p;
}

/** Immeuble voisin, dans l'ombre : mur sombre, fenêtres éclairées au hasard. */
export function makeSideBuilding(w: number, h: number, seed: number): Pix {
  const p = new Pix(w, h);
  const r = rng(seed);
  p.rect(0, 0, w, h, "n3").hline(0, 0, w, "s1").rect(0, 1, w, 3, "i2").hline(0, 4, w, "n2");
  p.dither(0, 5, w, h - 5, "n2", 3);
  for (let y = 9; y < h - 10; y += 10)
    for (let x = 3; x < w - 6; x += 9) {
      const v = r();
      p.rect(x, y, 6, 6, "n1").frame(x - 1, y - 1, 8, 8, "i1");
      if (v < 0.35) p.rect(x + 1, y + 1, 4, 4, v < 0.2 ? "amD" : "cyD").set(x + 1, y + 1, v < 0.2 ? "am" : "cy");
      p.hline(x - 1, y + 7, 8, "i2");
    }
  p.rect(0, h - 4, w, 4, "i1");
  return p;
}
