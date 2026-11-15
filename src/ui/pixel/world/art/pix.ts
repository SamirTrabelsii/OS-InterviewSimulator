import { DARKER, PACKED, colOf, type Col } from "./palette";

/** Matrice de Bayer 4×4 : tramage ordonné (valeurs 0..15). */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export const bayer = (x: number, y: number): number => BAYER[((y & 3) << 2) | (x & 3)];

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tampon de pixels opaque/transparent, dessiné couleur par couleur de la
 * palette. Aucune dépendance au navigateur (sauf toCanvas) : les sprites se
 * génèrent et se testent sous Node.
 */
export class Pix {
  readonly buf: Uint32Array;
  private cv: HTMLCanvasElement | null = null;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.buf = new Uint32Array(w * h);
  }

  set(x: number, y: number, c: Col): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] = PACKED[c];
    return this;
  }
  clear(x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] = 0;
    return this;
  }
  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.buf[y * this.w + x];
  }
  at(x: number, y: number): Col | undefined {
    const v = this.get(x, y);
    return v ? colOf(v) : undefined;
  }

  rect(x: number, y: number, w: number, h: number, c: Col): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  hline(x: number, y: number, w: number, c: Col): this {
    return this.rect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: Col): this {
    return this.rect(x, y, 1, h, c);
  }
  /** Contour d'un rectangle (1 pixel). */
  frame(x: number, y: number, w: number, h: number, c: Col): this {
    this.hline(x, y, w, c).hline(x, y + h - 1, w, c).vline(x, y, h, c).vline(x + w - 1, y, h, c);
    return this;
  }
  /** Tramage : peint les pixels dont le seuil de Bayer est sous `level` (0 = rien, 16 = plein). */
  dither(x: number, y: number, w: number, h: number, c: Col, level: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < level) this.set(x + i, y + j, c);
    return this;
  }
  /** Semis aléatoire de pixels (probabilité p). */
  scatter(x: number, y: number, w: number, h: number, c: Col, p: number, r: () => number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (r() < p) this.set(x + i, y + j, c);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) this.set(x, y, c);
      }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Col): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  /** Colle un autre tampon (les pixels transparents ne changent rien). */
  blit(src: Pix, dx: number, dy: number, flip = false): this {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const v = src.buf[y * src.w + x];
        if (!v) continue;
        const tx = dx + (flip ? src.w - 1 - x : x);
        if (tx >= 0 && dy + y >= 0 && tx < this.w && dy + y < this.h) this.buf[(dy + y) * this.w + tx] = v;
      }
    return this;
  }
  /** Copie d'une zone. */
  crop(x: number, y: number, w: number, h: number): Pix {
    const o = new Pix(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) o.buf[j * w + i] = this.get(x + i, y + j);
    return o;
  }
  flipX(): Pix {
    const o = new Pix(this.w, this.h);
    return o.blit(this, 0, 0, true);
  }
  /**
   * Contour sélectif : autour de la silhouette, chaque pixel vide voisin d'un
   * pixel plein prend l'échelon sombre de CE voisin (un contour coloré, pas
   * un trait noir). Par défaut le haut reste libre (sprites éclairés par le haut).
   */
  outline(opts: { top?: boolean; sides?: boolean; bottom?: boolean } = {}): this {
    const { top = false, sides = true, bottom = true } = opts;
    const snap = this.buf.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : snap[y * this.w + x]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (snap[y * this.w + x]) continue;
        const cand: number[] = [];
        if (bottom) cand.push(at(x, y - 1)); // pixel plein au-dessus : on est sous la silhouette
        if (sides) cand.push(at(x - 1, y), at(x + 1, y));
        if (top) cand.push(at(x, y + 1));
        const n = cand.find((v) => v);
        if (!n) continue;
        const c = colOf(n);
        if (c) this.set(x, y, DARKER[DARKER[c]]);
      }
    return this;
  }
  /** Version plus sombre de chaque pixel (reflet, ombre), même teinte. */
  darkened(steps = 1): Pix {
    const o = new Pix(this.w, this.h);
    for (let i = 0; i < this.buf.length; i++) {
      const c = colOf(this.buf[i]);
      if (!c) continue;
      let d: Col = c;
      for (let k = 0; k < steps; k++) d = DARKER[d];
      o.buf[i] = PACKED[d];
    }
    return o;
  }
  /** Couleurs réellement employées (pour les tests). */
  used(): Set<number> {
    const s = new Set<number>();
    for (const v of this.buf) if (v) s.add(v);
    return s;
  }
  isEmpty(): boolean {
    return this.buf.every((v) => !v);
  }
  signature(): string {
    let h = 2166136261;
    for (const v of this.buf) h = Math.imul(h ^ v, 16777619) >>> 0;
    return h.toString(16);
  }

  /** Bitmap navigateur (mis en cache). À n'appeler que côté client. */
  toCanvas(): HTMLCanvasElement {
    if (this.cv) return this.cv;
    const c = document.createElement("canvas");
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext("2d")!;
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.buf);
    g.putImageData(img, 0, 0);
    this.cv = c;
    return c;
  }
}
