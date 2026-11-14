/**
 * Catalogue des sprites : nom logique → fichier de public/sprites.
 *
 * Les composants ne connaissent QUE ces noms. Pour passer à un pack acheté
 * ou à un illustrateur : remplacer les fichiers (même nom) ou changer le
 * chemin ici. `w` et `h` sont la taille logique en pixels d'écran ; elle est
 * agrandie par un facteur entier (--ps). Les fichiers actuels sont des
 * substituts générés par scripts/make-sprites.mjs.
 */
export const SPRITES = {
  "gem-quiz": { src: "/sprites/gem-quiz.svg", w: 12, h: 10 },
  "gem-sql": { src: "/sprites/gem-sql.svg", w: 12, h: 10 },
  "gem-algo": { src: "/sprites/gem-algo.svg", w: 12, h: 10 },
  "gem-logique": { src: "/sprites/gem-logique.svg", w: 12, h: 10 },
  "gem-off": { src: "/sprites/gem-off.svg", w: 12, h: 10 },
  bip: { src: "/sprites/bip.svg", w: 12, h: 10 },
} as const;

export type SpriteName = keyof typeof SPRITES;
