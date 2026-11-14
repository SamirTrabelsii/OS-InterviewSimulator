// Génère les sprites SVG de substitution (gemmes, Bip) à partir d'un dessin
// en caractères. Ces fichiers sont REMPLAÇABLES : un pack acheté ou un
// illustrateur n'a qu'à écraser les fichiers de public/sprites (même nom,
// même taille logique) ; voir src/ui/pixel/sprites.ts.
import { mkdirSync, writeFileSync } from "node:fs";

const GEM = [
  "...oooooo...",
  "..ohhhmmmo..",
  ".ohhmmmmmmo.",
  "ohhmmmmmmmdo",
  "ohmmmmmmmddo",
  ".ommmmmmddo.",
  "..ommmmddo..",
  "...ommddo...",
  "....omdo....",
  ".....oo.....",
];
const BIP = [
  ".....oo.....",
  ".....aa.....",
  "..oooooooo..",
  ".obbbbbbbbo.",
  ".obeebbeebo.",
  ".obeebbeebo.",
  ".obbbbbbbbo.",
  ".obbmmmmbbo.",
  "..oooooooo..",
  "...o....o...",
];
const gems = {
  quiz: { o: "#1B6A75", h: "#B8FAFF", m: "#3EF0FF", d: "#1F8E99" },
  sql: { o: "#2E8F6A", h: "#C6FFE4", m: "#4DFFA6", d: "#2E8F6A" },
  algo: { o: "#8A2A74", h: "#FFB8F0", m: "#FF4FD8", d: "#8A2A74" },
  logique: { o: "#8A5A1A", h: "#FFD27A", m: "#FFB547", d: "#8A5A1A" },
  off: { o: "#2C3160", h: "#3A4170", m: "#262B52", d: "#1A1D36" },
};
const bip = { o: "#1B6A75", a: "#FF4FD8", b: "#22274A", e: "#3EF0FF", m: "#5A6196" };

function svg(rows, pal, label) {
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) throw new Error(`${label}: ligne de largeur ${r.length} ≠ ${w}`);
  const rects = [];
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const c = r[x];
      if (c === ".") continue;
      if (!pal[c]) throw new Error(`${label}: caractère ${c} inconnu`);
      rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${rows.length}" viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges">${rects.join("")}</svg>\n`;
}

mkdirSync("public/sprites", { recursive: true });
for (const [name, pal] of Object.entries(gems)) writeFileSync(`public/sprites/gem-${name}.svg`, svg(GEM, pal, name));
writeFileSync("public/sprites/bip.svg", svg(BIP, bip, "bip"));
console.log("sprites écrits dans public/sprites");
