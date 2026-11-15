/**
 * Catalogue des graphismes du monde : nom logique → fichier de
 * public/sprites/world. Le moteur de rendu ne connaît QUE ces noms.
 *
 * Pour passer à un pack acheté ou à un illustrateur : remplacer les fichiers
 * (mêmes noms, mêmes tailles logiques) ou changer les chemins ici. Les
 * fichiers actuels sont des substituts générés par
 * scripts/make-world-sprites.mjs. PNG et SVG sont acceptés.
 *
 * Tailles attendues (pixels logiques) :
 *   tile-*       8 × 8
 *   building-*   64 × 48
 *   portal-*     48 × 48
 *   lamp         8 × 24
 *   player       60 × 14 : 6 images de 10 × 14 côte à côte, par direction
 *                (bas, haut, côté gauche ; le côté droit est le miroir) et
 *                par pas de marche (2 images chacune).
 */
export const WORLD_ASSETS = [
  "tile-sky",
  "tile-alley",
  "tile-side",
  "tile-street",
  "tile-lane",
  "tile-plaza-a",
  "tile-plaza-b",
  "tile-ground",
  "building-savoir",
  "building-archives",
  "building-calcul",
  "building-intuition",
  "portal-closed",
  "portal-open-a",
  "portal-open-b",
  "lamp",
  "player",
  "gem-quiz",
  "gem-sql",
  "gem-algo",
  "gem-logique",
] as const;

export type WorldAsset = (typeof WORLD_ASSETS)[number];
export type Atlas = Record<WorldAsset, HTMLCanvasElement>;

/** Les gemmes sont partagées avec les composants (public/sprites) ; le reste vit dans public/sprites/world. */
export const assetUrl = (name: WorldAsset): string =>
  name.startsWith("gem-") ? `/sprites/${name}.svg` : `/sprites/world/${name}.svg`;

function rasterize(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 8;
  c.height = img.naturalHeight || 8;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function load(name: WorldAsset): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(rasterize(img));
    img.onerror = () => {
      // Fichier manquant : une tuile grise visible, plutôt qu'un monde cassé.
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const g = c.getContext("2d")!;
      g.fillStyle = "#5a6196";
      g.fillRect(0, 0, 8, 8);
      resolve(c);
    };
    img.src = assetUrl(name);
  });
}

let cache: Promise<Atlas> | null = null;

/** Charge (une seule fois) tous les graphismes et les convertit en bitmaps. */
export function loadAtlas(): Promise<Atlas> {
  cache ??= Promise.all(WORLD_ASSETS.map(load)).then(
    (list) => Object.fromEntries(WORLD_ASSETS.map((n, i) => [n, list[i]])) as Atlas,
  );
  return cache;
}
