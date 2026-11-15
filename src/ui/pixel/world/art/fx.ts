import { rgb, type Col } from "./palette";
import { Pix, bayer, rng } from "./pix";

/** Hachage déterministe 0..1 (pour les effets qui doivent être reproductibles). */
export function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/**
 * Grésillement d'un néon : plein feu presque tout le temps, avec de brèves
 * extinctions et un léger souffle. Retourne 0..1.
 */
export function flicker(t: number, seed: number, wild = 1): number {
  const slot = Math.floor(t * 14);
  const h = hash(slot * 31 + seed * 977);
  const burst = hash(Math.floor(t * 0.7) * 13 + seed * 331) < 0.16 * wild; // fenêtres où le tube « fatigue »
  if (burst && h < 0.45) return h < 0.18 ? 0.12 : 0.55;
  return 0.94 + 0.06 * Math.sin(t * 3 + seed);
}

// ── Lumières par paliers ─────────────────────────────────────

export interface Light {
  x: number;
  y: number;
  r: number;
  /** Demi-hauteur ; par défaut 0,7 × r (le sol vu de 3/4 écrase le halo). */
  ry?: number;
  color: Col;
  /** Intensité 0..1 */
  k: number;
  /** Cône vers le bas : x,y = sommet ; r = longueur ; ry = demi-largeur à la base. */
  cone?: boolean;
}

const STEPS = 4;

/** Calque de lumière à la résolution logique : halos à 4 paliers, tramés entre eux, ajoutés à l'image. */
export function createLightLayer(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  const img = g.createImageData(w, h);
  const acc = new Float32Array(w * h * 3);
  return {
    canvas,
    render(lights: readonly Light[]) {
      acc.fill(0);
      for (const l of lights) {
        if (l.k <= 0.01) continue;
        const [cr, cg, cb] = rgb(l.color);
        const ry = l.ry ?? l.r * 0.7;
        const x0 = Math.max(0, Math.floor(l.x - (l.cone ? ry : l.r)));
        const x1 = Math.min(w - 1, Math.ceil(l.x + (l.cone ? ry : l.r)));
        const y0 = Math.max(0, Math.floor(l.cone ? l.y : l.y - ry));
        const y1 = Math.min(h - 1, Math.ceil(l.cone ? l.y + l.r : l.y + ry));
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) {
            let t: number;
            if (l.cone) {
              const d = (y - l.y) / l.r;
              if (d < 0 || d > 1) continue;
              const half = 2 + ry * d;
              const off = Math.abs(x - l.x) / half;
              if (off >= 1) continue;
              t = (1 - d) * 0.7 * (1 - off);
            } else {
              const u = (x - l.x) / l.r;
              const v = (y - l.y) / ry;
              const d2 = u * u + v * v;
              if (d2 >= 1) continue;
              t = 1 - Math.sqrt(d2);
            }
            const lvl = Math.floor(t * STEPS + (bayer(x, y) / 16 - 0.5) * 0.95);
            if (lvl <= 0) continue;
            const s = Math.pow(lvl / STEPS, 1.35) * l.k;
            const i = (y * w + x) * 3;
            acc[i] += cr * s;
            acc[i + 1] += cg * s;
            acc[i + 2] += cb * s;
          }
      }
      const d = img.data;
      for (let p = 0, i = 0; p < w * h; p++, i += 3) {
        const r = acc[i];
        const gg = acc[i + 1];
        const b = acc[i + 2];
        const o = p * 4;
        if (r + gg + b < 1) {
          d[o + 3] = 0;
          continue;
        }
        d[o] = r > 255 ? 255 : r;
        d[o + 1] = gg > 255 ? 255 : gg;
        d[o + 2] = b > 255 ? 255 : b;
        d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return canvas;
    },
  };
}

// ── Pluie ────────────────────────────────────────────────────

/** Pluie fine et oblique : traînées de 1 × 3 pixels, deux profondeurs. */
export function drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity = 1): void {
  const n = Math.floor(170 * intensity);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const far = hash(i * 7 + 1) < 0.45;
    const speed = far ? 95 : 150;
    const x0 = hash(i * 13 + 5) * (w + 60);
    const y = (hash(i * 17 + 9) * (h + 20) + t * speed) % (h + 20);
    const x = Math.floor(((x0 - y * 0.28) % (w + 60) + (w + 60)) % (w + 60)) - 30;
    ctx.fillStyle = far ? "rgba(122,130,200,0.28)" : "rgba(184,196,255,0.45)";
    const yy = Math.floor(y) - 10;
    ctx.fillRect(x, yy, 1, far ? 2 : 3);
    ctx.fillRect(x - 1, yy + (far ? 2 : 3), 1, 1);
  }
  ctx.restore();
}

/** Éclaboussures au sol : petits arcs de 1 à 3 pixels sur 3 images. */
export function drawSplashes(ctx: CanvasRenderingContext2D, t: number, zone: { x: number; y: number; w: number; h: number }, count: number): void {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const period = 0.7 + hash(i * 3 + 2) * 1.3;
    const ph = ((t + hash(i * 5 + 1) * 10) % period) / period;
    if (ph > 0.3) continue;
    const f = Math.floor((ph / 0.3) * 3);
    const cyc = Math.floor((t + hash(i * 5 + 1) * 10) / period);
    const x = Math.floor(zone.x + hash(i * 11 + cyc * 17 + 3) * zone.w);
    const y = Math.floor(zone.y + hash(i * 19 + cyc * 23 + 7) * zone.h);
    ctx.fillStyle = f === 0 ? "rgba(200,210,255,0.7)" : "rgba(160,175,240,0.55)";
    if (f === 0) ctx.fillRect(x, y, 1, 1);
    else if (f === 1) {
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 1);
    } else {
      ctx.fillRect(x - 2, y, 1, 1);
      ctx.fillRect(x + 2, y, 1, 1);
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x + 1, y - 1, 1, 1);
    }
  }
  ctx.restore();
}

// ── Sprites d'effets (palette fermée) ────────────────────────

/** Vapeur d'égout : 12 × 20, 6 images en boucle. */
export function makeSteam(frame: number): Pix {
  const p = new Pix(12, 20);
  for (let k = 0; k < 4; k++) {
    const prog = (frame / 6 + k / 4) % 1;
    const cy = 17 - prog * 15;
    const cx = 6 + Math.sin(prog * 5 + k * 1.7) * 2.2;
    const r = 1.6 + prog * 3.8;
    const level = Math.round((1 - prog) * 11) + 1;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1);
        if (d > r) continue;
        if (bayer(x, y) < level - (d / r) * 4) p.set(x, y, prog < 0.5 ? "s1" : "i2");
      }
  }
  return p;
}

/** Étincelles d'un néon qui crache : 10 × 10, 4 images. */
export function makeSparks(frame: number): Pix {
  const p = new Pix(10, 10);
  const r = rng(40);
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.7;
    const d = 1 + frame * 1.15 + r() * 1.2;
    const x = Math.round(5 + Math.cos(a) * d);
    const y = Math.round(4 + Math.sin(a) * d + frame * 0.6);
    const c: Col = frame === 0 ? "amL" : frame === 1 ? "am" : frame === 2 ? "mgL" : "mgD";
    p.set(x, y, c);
  }
  if (frame < 2) p.set(5, 4, "moon").set(4, 4, "amL").set(6, 4, "amL");
  return p;
}

/** Bande de reflets pour les flaques : 16 × 4, motif tramé étiré. */
export function makeRipple(frame: number): Pix {
  const p = new Pix(16, 4);
  for (let x = 0; x < 16; x++) {
    const y = Math.round(1.5 + Math.sin((x + frame * 2) * 0.9));
    p.set(x, y, "s1");
  }
  return p;
}

/** Vignette : bords assombris par paliers, tramés (construite une seule fois). */
export function makeVignette(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  const ink = 0xff180c0b; // ABGR de #0b0c18
  const R = 26;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      const d = Math.min(dx, dy * 1.4);
      if (d >= R) continue;
      const level = (1 - d / R) * 11;
      if (bayer(x, y) < level) px[y * w + x] = ink;
    }
  g.putImageData(img, 0, 0);
  return c;
}
