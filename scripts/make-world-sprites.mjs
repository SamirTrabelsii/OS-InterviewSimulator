// Génère les sprites SVG de substitution du monde du hub (tuiles, bâtiments,
// portail, joueur). Ces fichiers sont REMPLAÇABLES : un pack acheté ou un
// illustrateur n'a qu'à écraser les fichiers de public/sprites/world (même
// nom, même taille) ; voir src/ui/pixel/world/atlas.ts pour le catalogue.
// Usage : node scripts/make-world-sprites.mjs
import { mkdirSync, writeFileSync } from "node:fs";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.p = Array.from({ length: h }, () => Array(w).fill(null));
  }
  px(x, y, c) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y][x] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  frame(x, y, w, h, c) {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }
  /** Copie une autre image à (ox, oy). */
  blit(o, ox, oy) {
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (o.p[y][x]) this.px(ox + x, oy + y, o.p[y][x]);
  }
  svg() {
    const rects = [];
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.p[y][x];
        if (!c) {
          x++;
          continue;
        }
        let e = x + 1;
        while (e < this.w && this.p[y][e] === c) e++;
        rects.push(`<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${c}"/>`);
        x = e;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
  }
}

const OUT = "public/sprites/world";
mkdirSync(OUT, { recursive: true });
const save = (name, img) => writeFileSync(`${OUT}/${name}.svg`, img.svg());

// ── Tuiles 8×8 ──────────────────────────────────────────────
function tile(name, base, speck, seed, n = 4, extra) {
  const r = rng(seed);
  const t = new Img(8, 8);
  t.rect(0, 0, 8, 8, base);
  for (let i = 0; i < n; i++) t.px(Math.floor(r() * 8), Math.floor(r() * 8), speck);
  if (extra) extra(t);
  save(name, t);
}
tile("tile-sky", "#0b0d1a", "#10132a", 1, 5);
tile("tile-alley", "#141830", "#181c38", 2, 3);
tile("tile-side", "#1d2244", "#262b52", 3, 3, (t) => t.rect(0, 7, 8, 1, "#151933"));
tile("tile-street", "#151931", "#1a1e3a", 4, 5);
tile("tile-lane", "#151931", "#1a1e3a", 5, 2, (t) => t.rect(0, 3, 5, 1, "#2a3060"));
tile("tile-plaza-a", "#1b2040", "#21274c", 6, 2, (t) => {
  t.rect(0, 7, 8, 1, "#151933");
  t.rect(7, 0, 1, 8, "#151933");
});
tile("tile-plaza-b", "#21274c", "#283062", 7, 2, (t) => {
  t.rect(0, 7, 8, 1, "#151933");
  t.rect(7, 0, 1, 8, "#151933");
});
tile("tile-ground", "#1a1630", "#0a0c1c", 8, 6);

// ── Bâtiments 64×48 (un par gemme) ─────────────────────────
const TONES = {
  savoir: { main: "#3ef0ff", dark: "#1f8e99", seed: 11 },
  archives: { main: "#4dffa6", dark: "#2e8f6a", seed: 12 },
  calcul: { main: "#ff4fd8", dark: "#8a2a74", seed: 13 },
  intuition: { main: "#ffb547", dark: "#8a5a1a", seed: 14 },
};
for (const [name, T] of Object.entries(TONES)) {
  const r = rng(T.seed);
  const b = new Img(64, 48);
  // toit
  b.rect(0, 0, 64, 6, "#10132a");
  b.rect(0, 0, 64, 1, T.dark);
  b.rect(0, 5, 64, 1, "#07080f");
  b.rect(4 + Math.floor(r() * 40), 2, 7, 3, "#22274a");
  // mur
  b.rect(0, 6, 64, 42, "#1a1d36");
  b.rect(0, 6, 2, 42, "#151933");
  b.rect(62, 6, 2, 42, "#151933");
  b.rect(0, 6, 64, 1, "#2c3160");
  // panneau d'enseigne (le texte est superposé en HTML)
  b.rect(4, 8, 56, 9, "#0b0c18");
  b.frame(4, 8, 56, 9, "#2c3160");
  // fenêtres
  for (const y of [21, 31]) {
    for (const x of [6, 16, 41, 51]) {
      const lit = r() < 0.55;
      b.rect(x, y, 7, 7, "#2c3160");
      b.rect(x + 1, y + 1, 5, 5, lit ? (r() < 0.5 ? "#ffd27a" : T.dark) : "#0e1020");
      if (lit) b.rect(x + 1, y + 1, 5, 1, "#fff0c0");
    }
  }
  // auvent et porte
  b.rect(25, 33, 14, 2, T.dark);
  b.rect(25, 33, 14, 1, T.main);
  b.rect(27, 35, 10, 13, "#07080f");
  b.rect(28, 36, 8, 12, T.dark);
  b.rect(31, 36, 2, 12, "#07080f");
  b.px(34, 42, T.main);
  save(`building-${name}`, b);
}

// ── Portail 48×48 : fermé, ouvert (2 images) ───────────────
function portal(open, phase) {
  const p = new Img(48, 48);
  const stone = "#3a4170";
  const stoneD = "#262b52";
  const stoneL = "#5a6196";
  // arche
  p.rect(4, 6, 40, 42, stone);
  p.rect(4, 6, 40, 2, stoneL);
  p.rect(4, 8, 4, 40, stoneD);
  p.rect(40, 8, 4, 40, stoneD);
  p.rect(10, 12, 28, 36, "#07080f");
  // coins arrondis du vide
  for (const [x, y] of [[10, 12], [37, 12]]) p.px(x, y, stone);
  p.rect(0, 44, 48, 4, stoneD);
  p.rect(0, 44, 48, 1, stone);
  // fissures
  if (!open) {
    p.rect(20, 16, 1, 6, "#1a1d36");
    p.rect(21, 22, 1, 5, "#1a1d36");
    p.rect(26, 30, 1, 8, "#1a1d36");
    p.rect(12, 14, 24, 32, "#0a0b16");
    p.rect(14, 18, 20, 1, "#151933");
  } else {
    // tourbillon par paliers
    const cols = ["#3ef0ff", "#9b6bff", "#ff4fd8", "#b8faff"];
    for (let y = 12; y < 44; y++) {
      for (let x = 10; x < 38; x++) {
        const d = Math.hypot(x - 24, y - 28);
        const band = Math.floor(d / 4 + phase) % cols.length;
        const edge = Math.abs(x - 24) > 12 || y < 14;
        p.px(x, y, d < 17 && !edge ? cols[band] : "#1b2040");
      }
    }
    p.frame(10, 12, 28, 32, "#b8faff");
  }
  return p;
}
save("portal-closed", portal(false, 0));
save("portal-open-a", portal(true, 0));
save("portal-open-b", portal(true, 2));

// ── Réverbère 8×24 ─────────────────────────────────────────
{
  const l = new Img(8, 24);
  l.rect(3, 6, 2, 18, "#22274a");
  l.rect(2, 22, 4, 2, "#151933");
  l.rect(1, 2, 6, 4, "#ffd27a");
  l.rect(2, 3, 4, 2, "#fff0c0");
  l.rect(1, 1, 6, 1, "#3a4170");
  save("lamp", l);
}

// ── Joueur : 3 directions × 2 images de marche (10×14) ─────
function walker(dir, step) {
  const s = new Img(10, 14);
  const skin = "#e8c4a0";
  const hair = "#3a2a55";
  const jacket = "#1f8e99";
  const stripe = "#3ef0ff";
  const legs = "#22274a";
  const shoe = "#07080f";
  // tête
  s.rect(2, 1, 6, 5, skin);
  s.rect(2, 0, 6, 2, hair);
  if (dir === "up") s.rect(2, 0, 6, 5, hair);
  if (dir === "down") {
    s.px(3, 3, "#07080f");
    s.px(6, 3, "#07080f");
  }
  if (dir === "side") {
    s.rect(6, 1, 2, 4, hair);
    s.px(3, 3, "#07080f");
  }
  // corps
  s.rect(dir === "side" ? 3 : 1, 6, dir === "side" ? 5 : 8, 5, jacket);
  s.rect(dir === "side" ? 4 : 4, 6, 2, 5, stripe);
  s.rect(dir === "side" ? 2 : 0, 7, 1, 3, jacket);
  if (dir !== "side") s.rect(9, 7, 1, 3, jacket);
  // jambes (le pas décale une jambe)
  if (dir === "side") {
    s.rect(3 + (step ? 1 : 0), 11, 2, 3 - (step ? 1 : 0), legs);
    s.rect(5 - (step ? 1 : 0), 11, 2, 3, legs);
    s.rect(3 + (step ? 1 : 0), 13, 2, 1, shoe);
    s.rect(5 - (step ? 1 : 0), 13, 2, 1, shoe);
  } else {
    s.rect(2, 11, 2, step ? 2 : 3, legs);
    s.rect(6, 11, 2, step ? 3 : 2, legs);
    s.rect(2, step ? 12 : 13, 2, 1, shoe);
    s.rect(6, step ? 13 : 12, 2, 1, shoe);
  }
  return s;
}
{
  const sheet = new Img(60, 14);
  ["down", "up", "side"].forEach((d, i) => {
    sheet.blit(walker(d, 0), i * 20, 0);
    sheet.blit(walker(d, 1), i * 20 + 10, 0);
  });
  save("player", sheet);
}
console.log("sprites du monde écrits dans", OUT);
