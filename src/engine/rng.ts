// Générateur pseudo-aléatoire déterministe (mulberry32).
// Même graine + même flux → exactement la même suite, sur toutes les
// machines. Ne sert qu'à générer du contenu, jamais à de la sécurité.

export type Seed = bigint | number | string;

/** Hachage 32 bits (FNV-1a) d'une chaîne. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private state: number;

  /**
   * @param seed   graine de la session (sessions.seed)
   * @param stream nom du flux : chaque épreuve tire dans son propre flux,
   *               pour qu'en modifier une ne change pas les autres.
   */
  constructor(
    private readonly seed: Seed,
    private readonly stream = "",
  ) {
    this.state = hash32(`${String(seed)}::${stream}`);
  }

  /** Flux dérivé, indépendant du flux courant. */
  fork(name: string): Rng {
    return new Rng(this.seed, this.stream ? `${this.stream}/${name}` : name);
  }

  /** Flottant dans [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Bornes invalides : [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Vrai avec la probabilité p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick() sur une liste vide");
    return items[this.int(0, items.length - 1)];
  }

  /** Copie mélangée (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** n éléments distincts, dans un ordre aléatoire. */
  sample<T>(items: readonly T[], n: number): T[] {
    if (n > items.length) throw new RangeError(`sample(${n}) sur ${items.length} éléments`);
    return this.shuffle(items).slice(0, n);
  }
}
