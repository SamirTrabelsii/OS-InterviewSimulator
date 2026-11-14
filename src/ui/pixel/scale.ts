/** Résolution logique du monde pixel (hub, partie 2) : fixe, jamais redimensionnée. */
export const WORLD_W = 320;
export const WORLD_H = 200;

/**
 * Plus grand facteur ENTIER qui fait tenir la résolution logique dans la
 * zone disponible. Jamais fractionnaire (sinon les pixels deviennent flous
 * ou inégaux) ; au minimum 1.
 */
export function integerScale(availW: number, availH: number, baseW = WORLD_W, baseH = WORLD_H): number {
  if (!Number.isFinite(availW) || !Number.isFinite(availH)) return 1;
  const s = Math.floor(Math.min(availW / baseW, availH / baseH));
  return Math.max(1, s);
}
