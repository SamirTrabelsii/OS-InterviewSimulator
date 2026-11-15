/**
 * Avatar pixel d'un candidat : 5 × 5 cases, symétrique, tiré d'une graine
 * stable (identifiant de session). Pure et déterministe : le même texte
 * donne toujours le même avatar. Remplaçable plus tard par de vrais sprites.
 */
export const AVATAR_SIZE = 5;
export const AVATAR_TONES = ["cyan", "green", "magenta", "amber", "violet"] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

/** FNV-1a 32 bits. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** xorshift32 : suite pseudo-aléatoire à partir d'une graine. */
function rng(seed: number): () => number {
  let x = seed || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
}

export type Avatar = { cells: boolean[][]; tone: AvatarTone };

export function makeAvatar(seedText: string): Avatar {
  const next = rng(hash32(seedText));
  const half = Math.ceil(AVATAR_SIZE / 2);
  const cells: boolean[][] = [];
  for (let y = 0; y < AVATAR_SIZE; y++) {
    const row: boolean[] = new Array<boolean>(AVATAR_SIZE).fill(false);
    for (let x = 0; x < half; x++) {
      // La colonne centrale est plus souvent pleine : silhouette lisible.
      const on = next() % (x === half - 1 ? 3 : 2) !== 0;
      row[x] = on;
      row[AVATAR_SIZE - 1 - x] = on;
    }
    cells.push(row);
  }
  return { cells, tone: AVATAR_TONES[next() % AVATAR_TONES.length] };
}
