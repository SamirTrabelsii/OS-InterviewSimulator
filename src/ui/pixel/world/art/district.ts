import { BH, BUILDING_IDS, SIGN, type BuildingId } from "./buildings";
import { PALETTE, RAMP, type Col } from "./palette";
import { flicker, createLightLayer, drawRain, drawSplashes, makeVignette, hash, type Light } from "./fx";
import { PORTAL_CENTER, PW as PORTAL_W, SOCKETS, type PortalState } from "./portal";
import { BULB_COLORS, LAMP_LIGHT } from "./props";
import { makeSideBuilding, makeSkyline } from "./skyline";
import { bayer } from "./pix";
import type { Pix } from "./pix";
import { BUILDINGS, PORTAL_RECT, PROPS, WORLD_H, WORLD_W, isWalkable } from "@/engine/hub/world";
import { getArt, GEM_KINDS, type Art, type Dir } from "./index";
import type { GemKind } from "./hero";

/** Un quartier assemblé : 26 × 20 tuiles de 16 px. */
export const DW = WORLD_W;
export const DH = WORLD_H;
const BX = BUILDINGS.map((b) => b.rect.x);
const BASE_Y = 128;
const BUILDING_Y = BASE_Y - BH;
const PORTAL_POS = { x: PORTAL_RECT.x, y: PORTAL_RECT.y };

const PUDDLES: { x: number; y: number; k: "puddle-a" | "puddle-b" }[] = [
  { x: 46, y: 160, k: "puddle-a" },
  { x: 140, y: 176, k: "puddle-b" },
  { x: 286, y: 164, k: "puddle-a" },
  { x: 100, y: 192, k: "puddle-b" },
  { x: 356, y: 180, k: "puddle-a" },
  { x: 58, y: 240, k: "puddle-a" },
  { x: 150, y: 296, k: "puddle-a" },
  { x: 262, y: 292, k: "puddle-b" },
  { x: 330, y: 250, k: "puddle-b" },
];

export interface Input {
  dx: number;
  dy: number;
}

export interface DistrictState {
  px: number;
  py: number;
  dir: Dir;
  moving: boolean;
  walkT: number;
  portal: PortalState;
  /** Bip suit le joueur avec un peu de retard. */
  bx: number;
  by: number;
}

export interface RenderOpts {
  rain: boolean;
  lights: boolean;
  /** Animations réduites : pas de grésillement, pas de pluie. */
  reduced: boolean;
  /** Affiche la vapeur, les flaques animées, etc. */
  details: boolean;
  /** Mode hub : gemmes obtenues (elles flottent au-dessus de leur bâtiment et s'allument sur le Portail). Absent : mode démo. */
  done?: Record<GemKind, boolean>;
  /** Bip suit le joueur (par défaut : en mode démo seulement). */
  bip?: boolean;
}

const hex = (c: Col) => PALETTE[c];
const GEM_TONE: Record<GemKind, "cyan" | "green" | "magenta" | "amber"> = { quiz: "cyan", sql: "green", algo: "magenta", logique: "amber" };

function dither(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, level: number): void {
  ctx.fillStyle = color;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < level) ctx.fillRect(x + i, y + j, 1, 1);
}

function shadow(ctx: CanvasRenderingContext2D, cx: number, y: number, rx: number): void {
  ctx.fillStyle = "rgba(4,5,12,0.5)";
  ctx.fillRect(Math.round(cx - rx + 1), y - 1, Math.round(rx * 2 - 2), 1);
  ctx.fillRect(Math.round(cx - rx), y, Math.round(rx * 2), 1);
  ctx.fillStyle = "rgba(4,5,12,0.28)";
  ctx.fillRect(Math.round(cx - rx + 2), y + 1, Math.round(rx * 2 - 4), 1);
}

/** Couche fixe : ciel, ruelles, sol, ombres. Dessinée une seule fois. */
function buildStatic(art: Art): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = DW;
  cv.height = DH;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const put = (p: Pix, x: number, y: number) => ctx.drawImage(p.toCanvas(), x, y);

  put(makeSkyline(DW, 80), 0, 0);
  // bâtiments voisins dans les marges
  put(makeSideBuilding(24, BASE_Y - 44, 5), 0, 44);
  put(makeSideBuilding(24, BASE_Y - 56, 9), 392, 56);
  // ruelles entre les bâtiments : mur de fond, tuyaux, gravier
  for (let k = 0; k < 3; k++) {
    const x0 = BX[k] + 80;
    ctx.fillStyle = hex("n1");
    ctx.fillRect(x0, 36, 16, BASE_Y - 36);
    dither(ctx, x0, 36, 16, BASE_Y - 36, hex("ink"), 6);
    ctx.fillStyle = hex("i1");
    ctx.fillRect(x0 + 3, 50, 2, BASE_Y - 50);
    ctx.fillStyle = hex("n3");
    ctx.fillRect(x0 + 4, 50, 1, BASE_Y - 50);
    ctx.fillStyle = hex("i2");
    ctx.fillRect(x0 + 11, 70, 2, BASE_Y - 70);
    dither(ctx, x0, BASE_Y - 30, 16, 30, hex(k === 1 ? "mgD" : k === 0 ? "cyD" : "amD"), 3);
    for (let y = BASE_Y - 16; y < BASE_Y; y += 16) put(art.ground["gravel"], x0, y);
  }
  // sol : rangées de tuiles
  const tile = (name: string, tx: number, ty: number) => put(art.ground[name], tx * 16, ty * 16);
  const COLS = DW / 16;
  for (let tx = 0; tx < COLS; tx++) {
    tile(tx % 2 ? "pave-b" : "pave-a", tx, 8);
    tile("curb-s", tx, 9);
    const cross = tx >= 11 && tx <= 14;
    for (const ty of [10, 11, 12]) {
      let name = ["asphalt-a", "asphalt-b", "asphalt-c"][(hash(tx * 13 + ty) * 3) | 0];
      if (cross) name = "crosswalk";
      else if (ty === 11) name = "road-dash";
      tile(name, tx, ty);
    }
    tile("curb-n", tx, 13);
    for (let ty = 14; ty < 20; ty++) tile((tx + ty) % 2 ? "plaza-b" : "plaza-a", tx, ty);
  }
  tile("manhole", 3, 11);
  tile("grate", 8, 8);
  tile("grate", 19, 8);
  for (const tx of [10, 11, 12, 13, 14, 15]) tile("plaza-circuit", tx, 14);
  for (const ty of [15, 16, 17]) {
    tile("plaza-circuit", 7, ty);
    tile("plaza-circuit", 18, ty);
  }
  // ombres portées des bâtiments sur le trottoir
  for (const bx of BX) {
    ctx.fillStyle = "rgba(4,5,12,0.55)";
    ctx.fillRect(bx - 2, BASE_Y, 84, 3);
    dither(ctx, bx - 2, BASE_Y + 3, 84, 4, "rgba(4,5,12,0.55)", 9);
    dither(ctx, bx - 2, BASE_Y + 7, 84, 3, "rgba(4,5,12,0.55)", 4);
  }
  // ombres des objets
  for (const pr of PROPS) {
    const s = art.props[pr.sprite];
    if (pr.sprite === "crate-stack" && pr.base < 130) continue;
    shadow(ctx, pr.x + s.w / 2 + 1, pr.base - 1, Math.max(3, s.w / 2));
  }
  shadow(ctx, PORTAL_POS.x + PORTAL_W / 2, 307, 30);
  return cv;
}

export interface District {
  w: number;
  h: number;
  state: DistrictState;
  update(dtMs: number, input: Input): void;
  render(ctx: CanvasRenderingContext2D, t: number, opts: RenderOpts): void;
}

export function createDistrict(): District {
  const art = getArt();
  const statics = buildStatic(art);
  const lightLayer = createLightLayer(DW, DH);
  const vignette = makeVignette(DW, DH);
  const state: DistrictState = { px: 150, py: 246, dir: "down", moving: false, walkT: 0, portal: "closed", bx: 164, by: 216 };

  const blocked = (x: number, y: number) => !isWalkable({ x, y });

  function update(dtMs: number, input: Input) {
    const dt = Math.min(dtMs, 80) / 1000;
    const moving = input.dx !== 0 || input.dy !== 0;
    state.moving = moving;
    if (moving) {
      const len = Math.hypot(input.dx, input.dy);
      const sp = 50 * dt;
      const nx = state.px + (input.dx / len) * sp;
      const ny = state.py + (input.dy / len) * sp;
      if (!blocked(nx, state.py)) state.px = nx;
      if (!blocked(state.px, ny)) state.py = ny;
      state.dir = Math.abs(input.dx) > Math.abs(input.dy) ? (input.dx < 0 ? "left" : "right") : input.dy < 0 ? "up" : "down";
      state.walkT += dt;
    } else state.walkT = 0;
    // Bip suit avec retard
    const tx = state.px + 14;
    const ty = state.py - 30;
    state.bx += (tx - state.bx) * Math.min(1, dt * 3);
    state.by += (ty - state.by) * Math.min(1, dt * 3);
  }

  function render(ctx: CanvasRenderingContext2D, t: number, opts: RenderOpts) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const img = (p: Pix, x: number, y: number) => ctx.drawImage(p.toCanvas(), Math.round(x), Math.round(y));

    ctx.drawImage(statics, 0, 0);

    const lights: Light[] = [];
    const flk: Record<BuildingId, number> = { savoir: 1, archives: 1, calcul: 1, intuition: 1 };
    BUILDING_IDS.forEach((id, i) => (flk[id] = opts.reduced ? 1 : flicker(t, i + 1, i === 2 ? 1.6 : 1)));

    // reflets des enseignes sur le sol mouillé (avant les objets)
    BUILDING_IDS.forEach((id, i) => {
      const a = art.buildings[id];
      const f = flk[id];
      if (f < 0.5) return;
      const cv = a.signOn.toCanvas();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const rows = 8;
      for (let j = 0; j < rows; j++) {
        const sy = Math.floor((j / rows) * cv.height);
        const wob = opts.reduced ? 0 : Math.round(Math.sin(t * 2.4 + j * 0.9 + i) * 1);
        ctx.globalAlpha = 0.2 * (1 - j / rows) * f;
        ctx.drawImage(cv, 0, cv.height - 1 - sy - 1, cv.width, 2, BX[i] + SIGN.x - 1 + wob, BASE_Y + 12 + j * 1, cv.width, 1);
      }
      ctx.restore();
    });

    // flaques : eau sombre + reflet du néon le plus proche
    for (const [pi, pd] of PUDDLES.entries()) {
      const pix = art.ground[pd.k];
      img(pix, pd.x, pd.y);
      // couleur du reflet : bâtiment le plus proche en x, sinon violet du Portail
      let color: Col = "v3";
      if (pd.y < 220) {
        const bi = Math.min(3, Math.max(0, Math.round((pd.x - BX[0] - 40) / 96)));
        color = RAMP[art.buildings[BUILDING_IDS[bi]].tone].L;
      } else if (pd.x > 120 && pd.x < 300) color = "cyL";
      else color = pd.x < 160 ? "mgL" : "cyL";
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const shift = opts.reduced ? 0 : Math.floor(t * 2.2);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (!pix.get(x, y)) continue;
          const wave = (y + shift + (x >> 2) * 2 + pi) % 4;
          if (wave === 0 && bayer(x, y) < 8) {
            ctx.globalAlpha = 0.34;
            ctx.fillStyle = hex(color);
            ctx.fillRect(pd.x + x, pd.y + y, 1, 1);
          }
        }
      if (!opts.reduced && ((t * 1.3 + pi * 0.37) % 1) < 0.08) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = hex("cyW");
        ctx.fillRect(pd.x + 5 + (pi % 4) * 2, pd.y + 7, 1, 1);
      }
      ctx.restore();
    }

    // guirlande entre les deux lampadaires de la place (derrière le Portail)
    {
      const ax = 62 + LAMP_LIGHT.x - 4;
      const bx = 338 + LAMP_LIGHT.x - 4;
      const ay = 300 - 48 + 5;
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = Math.round(ax + (bx - ax) * u);
        const y = Math.round(ay + 18 * 4 * u * (1 - u));
        ctx.fillStyle = hex("n3");
        ctx.fillRect(x, y, 1, 1);
        if (i % 2 === 1) {
          const c = BULB_COLORS[(i >> 1) % BULB_COLORS.length];
          const on = opts.reduced ? 1 : flicker(t, 50 + i, 0.5) > 0.6 ? 1 : 0.35;
          ctx.fillStyle = hex(c);
          ctx.globalAlpha = on;
          ctx.fillRect(x, y + 1, 1, 2);
          ctx.globalAlpha = 1;
          lights.push({ x, y: y + 2, r: 9, ry: 7, color: c, k: 0.3 * on });
        }
      }
    }

    // objets triés en profondeur
    interface Ent {
      y: number;
      draw: () => void;
    }
    const ents: Ent[] = [];
    BUILDING_IDS.forEach((id, i) => {
      ents.push({
        y: BASE_Y,
        draw: () => img(flk[id] > 0.5 ? art.buildings[id].on : art.buildings[id].off, BX[i], BUILDING_Y),
      });
    });
    for (const pr of PROPS) {
      const s = art.props[pr.sprite];
      ents.push({ y: pr.base, draw: () => img(s, pr.x, pr.base - s.h) });
    }
    const pFrames = art.portal[state.portal];
    const pf = pFrames[Math.floor(t * (state.portal === "open" ? 8 : state.portal === "charging" ? 6 : 1.5)) % pFrames.length];
    ents.push({
      y: PORTAL_POS.y + 88,
      draw: () => {
        img(pf, PORTAL_POS.x, PORTAL_POS.y);
        if (opts.done && state.portal === "closed") {
          GEM_KINDS.forEach((k, i) => {
            if (!opts.done![k]) return;
            const sk = SOCKETS[i];
            ctx.fillStyle = hex(RAMP[GEM_TONE[k]].L);
            ctx.fillRect(PORTAL_POS.x + sk.x, PORTAL_POS.y + sk.y, sk.w, sk.h - 1);
            ctx.fillStyle = hex("moon");
            ctx.fillRect(PORTAL_POS.x + sk.x + 1, PORTAL_POS.y + sk.y + 1, 2, 2);
          });
        }
      },
    });
    // joueur
    const set = art.player[state.dir];
    const frames = state.moving ? set.walk : set.idle;
    const fi = state.moving ? Math.floor(state.walkT * 8) % 4 : Math.floor(t * 1.6) % 2;
    ents.push({
      y: state.py,
      draw: () => {
        shadow(ctx, state.px, Math.round(state.py), 5);
        img(frames[fi], state.px - 8, state.py - 23);
      },
    });
    // gemmes : près du Portail (démo) ou au-dessus du bâtiment dont elles viennent (hub)
    const gemSpots = GEM_KINDS.flatMap((k, i) => {
      if (opts.done) return opts.done[k] ? [{ k, i, x: BX[i] + 34, y: 3, ground: 0 }] : [];
      return [{ k, i, x: [132, 158, 258, 284][i], y: 262, ground: 273 }];
    });
    for (const g of gemSpots) {
      const bob = opts.reduced ? 0 : Math.round(Math.sin(t * 2 + g.i * 1.4) * 2);
      ents.push({
        y: g.ground || 400,
        draw: () => {
          if (g.ground) shadow(ctx, g.x + 6, g.ground, 4);
          img(art.gems[g.k][opts.reduced ? 0 : Math.floor(t * 4 + g.i) % 4], g.x, g.y + bob);
        },
      });
    }
    if (opts.bip ?? !opts.done) {
      ents.push({ y: state.by + 12, draw: () => img(art.bip[Math.floor(t * 5) % 4], state.bx - 6, state.by - 7 + Math.round(Math.sin(t * 3) * 1)) });
    }
    ents.sort((a, b) => a.y - b.y);
    ents.forEach((e) => e.draw());

    // balise clignotante des Archives et vapeur des cheminées de Calcul
    if (opts.details) {
      const beacon = Math.floor(t * 1.6) % 2 === 0;
      if (beacon) {
        ctx.fillStyle = hex("mgW");
        ctx.fillRect(BX[1] + 73, BUILDING_Y + 18, 1, 1);
        lights.push({ x: BX[1] + 73, y: BUILDING_Y + 20, r: 10, ry: 8, color: "mgL", k: 0.55 });
      }
      const steam = art.steam;
      for (const [sx, sy, sf] of [[BX[2] + 52, BUILDING_Y + 24 - 20, 0], [BX[2] + 62, BUILDING_Y + 24 - 20, 3], [3 * 16 + 2, 11 * 16 - 8, 1]] as const) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(steam[(Math.floor(t * 5) + sf) % 6].toCanvas(), sx, sy);
        ctx.globalAlpha = 1;
      }
      if (!opts.reduced && hash(Math.floor(t * 6) * 3 + 1) < 0.07) {
        ctx.drawImage(art.sparks[Math.floor((t * 6) % 4)].toCanvas(), BX[0] + 80 + 3, 74);
      }
    }

    // lumières
    if (opts.lights) {
      BUILDING_IDS.forEach((id, i) => {
        const R = RAMP[art.buildings[id].tone];
        const f = flk[id];
        const cx = BX[i] + 40;
        lights.push({ x: cx, y: BUILDING_Y + SIGN.y + 7, r: 44, ry: 22, color: R.L, k: 0.42 * f });
        lights.push({ x: cx, y: BASE_Y + 14, r: 54, ry: 20, color: R.L, k: 0.34 * f });
        lights.push({ x: cx, y: BASE_Y - 6, r: 20, ry: 14, color: "amL", k: 0.4 });
        lights.push({ x: BX[i] + 16, y: BUILDING_Y + 87, r: 18, ry: 13, color: "amL", k: 0.28 });
        lights.push({ x: BX[i] + 64, y: BUILDING_Y + 87, r: 18, ry: 13, color: "amL", k: 0.28 });
      });
      for (const pr of PROPS) {
        if (pr.sprite === "lamp") {
          const hx = pr.x + LAMP_LIGHT.x;
          const hy = pr.base - 48 + LAMP_LIGHT.y;
          const f = opts.reduced ? 1 : flicker(t, pr.x, 0.7);
          lights.push({ x: hx, y: hy, r: 14, ry: 12, color: "amL", k: 0.75 * f });
          lights.push({ x: hx - 2, y: hy + 2, r: 44, ry: 38, color: "am", k: 0.26 * f, cone: true });
          lights.push({ x: pr.x + 8, y: pr.base + 2, r: 46, ry: 20, color: "am", k: 0.36 * f });
        } else if (pr.glow) {
          const s = art.props[pr.sprite];
          lights.push({ x: pr.x + s.w / 2, y: pr.base - s.h / 2, r: pr.glow.r, color: pr.glow.color, k: pr.glow.k * (opts.reduced ? 1 : flicker(t, pr.x + 3, 1.2)) });
          lights.push({ x: pr.x + s.w / 2, y: pr.base + 3, r: pr.glow.r * 1.5, ry: 9, color: pr.glow.color, k: pr.glow.k * 0.6 });
        }
      }
      const open = state.portal === "open" ? 1 : state.portal === "charging" ? 0.5 : 0.14;
      const pulse = 0.9 + 0.1 * Math.sin(t * 3);
      lights.push({ x: PORTAL_POS.x + PORTAL_CENTER.x, y: PORTAL_POS.y + PORTAL_CENTER.y, r: 66, ry: 56, color: "v3", k: 0.5 * open * pulse });
      lights.push({ x: PORTAL_POS.x + PORTAL_CENTER.x, y: 296, r: 82, ry: 26, color: state.portal === "open" ? "cyL" : "v2", k: 0.5 * open * pulse });
      lights.push({ x: PORTAL_POS.x + PORTAL_CENTER.x, y: PORTAL_POS.y + PORTAL_CENTER.y, r: 24, ry: 34, color: "cyW", k: 0.35 * open });
      for (const g of gemSpots) lights.push({ x: g.x + 6, y: g.y + 6, r: 14, ry: 12, color: RAMP[GEM_TONE[g.k]].L, k: 0.55 });
      if (opts.bip ?? !opts.done) lights.push({ x: state.bx, y: state.by, r: 14, ry: 12, color: "cyL", k: 0.42 });
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(lightLayer.render(lights), 0, 0);
      ctx.restore();
    }

    if (opts.rain && !opts.reduced) {
      drawSplashes(ctx, t, { x: 6, y: 138, w: DW - 12, h: DH - 144 }, 46);
      drawRain(ctx, DW, DH, t, 1);
    }
    ctx.drawImage(vignette, 0, 0);
  }

  return { w: DW, h: DH, state, update, render };
}

