import { BUILDINGS, PORTAL_RECT, TILE, WORLD_H, WORLD_W, type Facing, type TargetId, type Vec } from "@/engine/hub/world";
import type { Atlas } from "./atlas";

type GemKey = Exclude<TargetId, "portail">;

export interface SceneState {
  /** Temps en ms (pour les animations par paliers). */
  t: number;
  reduced: boolean;
  player: Vec;
  facing: Facing;
  moving: boolean;
  done: Record<GemKey, boolean>;
  portalOpen: boolean;
}

const TONE_COLOR: Record<GemKey, string> = { quiz: "#3ef0ff", sql: "#4dffa6", algo: "#ff4fd8", logique: "#ffb547" };
const GEM_ORDER: GemKey[] = ["quiz", "sql", "algo", "logique"];
const LAMPS = [84, 164, 244];

/** Disque plein à bords nets (pas d'anti-crénelage) : une rangée par ligne. */
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
  }
}

/** Lumière par paliers : 3 disques concentriques qui s'additionnent. */
function light(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number) {
  g.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    g.globalAlpha = alpha;
    disc(g, Math.round(cx), Math.round(cy), Math.round(r * (1 - k / 3)));
  }
  g.globalAlpha = 1;
}

function tileFor(col: number, row: number): "tile-sky" | "tile-alley" | "tile-side" | "tile-street" | "tile-lane" | "tile-plaza-a" | "tile-plaza-b" | "tile-ground" {
  if (row < 4) return "tile-sky";
  if (row < 10) return "tile-alley";
  if (row === 10) return "tile-side";
  if (row === 11) return "tile-lane";
  if (row === 12) return "tile-street";
  if (col >= 12 && col < 28) return (col + row) % 2 === 0 ? "tile-plaza-a" : "tile-plaza-b";
  return "tile-ground";
}

/** Décor fixe : sol, horizon, bâtiments, réverbères. Dessiné une seule fois. */
export function buildStatic(atlas: Atlas): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = WORLD_W;
  c.height = WORLD_H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;

  for (let row = 0; row < WORLD_H / TILE; row++) {
    for (let col = 0; col < WORLD_W / TILE; col++) {
      g.drawImage(atlas[tileFor(col, row)], col * TILE, row * TILE);
    }
  }

  // Horizon : silhouettes d'immeubles lointains et quelques fenêtres allumées.
  const sky: Array<[number, number, number, number]> = [
    [8, 6, 22, 26], [34, 2, 16, 30], [58, 8, 26, 24], [110, 4, 20, 28], [196, 6, 24, 26], [226, 1, 14, 31], [262, 7, 30, 25],
  ];
  g.fillStyle = "#0f1226";
  for (const [x, y, w, h] of sky) g.fillRect(x, y, w, h);
  const specks: Array<[number, number, string]> = [
    [12, 9, "#ffd27a"], [38, 6, "#3ef0ff"], [42, 12, "#ffd27a"], [64, 12, "#ff4fd8"], [116, 8, "#ffd27a"],
    [202, 10, "#3ef0ff"], [230, 5, "#ff4fd8"], [270, 11, "#ffd27a"], [284, 14, "#3ef0ff"],
  ];
  for (const [x, y, col] of specks) {
    g.fillStyle = col;
    g.globalAlpha = 0.6;
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;

  for (const b of BUILDINGS) g.drawImage(atlas[b.sprite], b.rect.x, b.rect.y);
  for (const x of LAMPS) g.drawImage(atlas.lamp, x - 4, 56);

  // Flaques de néon sur la chaussée.
  const puddles: Array<[number, number, number, number, string, number]> = [
    [118, 93, 14, 2, "#3ef0ff", 0.14], [252, 90, 10, 2, "#ff4fd8", 0.16], [40, 94, 12, 2, "#ffb547", 0.12], [190, 92, 12, 2, "#4dffa6", 0.12],
  ];
  for (const [x, y, w, h, col, a] of puddles) {
    g.fillStyle = col;
    g.globalAlpha = a;
    g.fillRect(x, y, w, h);
  }
  g.globalAlpha = 1;
  return c;
}

function drawPlayer(g: CanvasRenderingContext2D, atlas: Atlas, s: SceneState) {
  const dir = s.facing === "down" ? 0 : s.facing === "up" ? 1 : 2;
  const step = s.moving && Math.floor(s.t / 140) % 2 === 1 ? 1 : 0;
  const sx = dir * 20 + step * 10;
  const x = Math.round(s.player.x - 5);
  const y = Math.round(s.player.y + 2 - 14);
  // ombre
  g.fillStyle = "#000000";
  g.globalAlpha = 0.35;
  g.fillRect(Math.round(s.player.x) - 3, Math.round(s.player.y) + 1, 6, 2);
  g.globalAlpha = 1;
  if (s.facing === "right") {
    g.save();
    g.translate(x + 10, y);
    g.scale(-1, 1);
    g.drawImage(atlas.player, sx, 0, 10, 14, 0, 0, 10, 14);
    g.restore();
  } else {
    g.drawImage(atlas.player, sx, 0, 10, 14, x, y, 10, 14);
  }
}

function drawPortal(g: CanvasRenderingContext2D, atlas: Atlas, s: SceneState) {
  const frame = !s.portalOpen
    ? atlas["portal-closed"]
    : !s.reduced && Math.floor(s.t / 450) % 2 === 1
      ? atlas["portal-open-b"]
      : atlas["portal-open-a"];
  g.drawImage(frame, PORTAL_RECT.x, PORTAL_RECT.y);
  // 4 emplacements de gemmes sur le linteau : allumés quand la gemme est acquise.
  GEM_ORDER.forEach((gem, i) => {
    g.fillStyle = s.done[gem] ? TONE_COLOR[gem] : "#1a1d36";
    g.fillRect(PORTAL_RECT.x + 14 + i * 6, PORTAL_RECT.y + 8, 3, 3);
  });
}

/** Une image du monde : décor fixe, lumières, personnages triés par profondeur. */
export function drawFrame(g: CanvasRenderingContext2D, atlas: Atlas, statics: HTMLCanvasElement, s: SceneState) {
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.drawImage(statics, 0, 0);

  // Enseignes : un voile de la couleur du néon tant que la gemme reste à prendre.
  for (const b of BUILDINGS) {
    if (s.done[b.gem]) continue;
    const on = s.reduced || Math.floor(s.t / 90) % 41 !== 7; // petit clignotement rare
    g.fillStyle = TONE_COLOR[b.gem];
    g.globalAlpha = on ? 0.16 : 0.05;
    g.fillRect(b.rect.x + 5, b.rect.y + 9, 54, 7);
    g.globalAlpha = 1;
  }

  // Objets triés par profondeur : le Portail passe devant le joueur s'il est au nord.
  const portalBase = PORTAL_RECT.y + PORTAL_RECT.h - 8;
  if (s.player.y < portalBase) {
    drawPlayer(g, atlas, s);
    drawPortal(g, atlas, s);
  } else {
    drawPortal(g, atlas, s);
    drawPlayer(g, atlas, s);
  }

  // Gemmes obtenues, qui flottent au-dessus de leur bâtiment (1 px d'amplitude, par paliers).
  for (const b of BUILDINGS) {
    if (!s.done[b.gem]) continue;
    const bob = !s.reduced && Math.floor(s.t / 500) % 2 === 1 ? 1 : 0;
    g.drawImage(atlas[`gem-${b.gem}`], b.rect.x + 32 - 6, b.rect.y - 14 + bob);
  }

  // Lumières additives par paliers.
  g.globalCompositeOperation = "lighter";
  for (const x of LAMPS) light(g, x, 62, 12, "#ffd27a", 0.035);
  for (const b of BUILDINGS) {
    const cx = b.rect.x + 32;
    const open = !s.done[b.gem];
    light(g, cx, b.rect.y + b.rect.h + 2, open ? 15 : 9, TONE_COLOR[b.gem], open ? 0.05 : 0.03);
    if (s.done[b.gem]) light(g, cx, b.rect.y - 8, 12, TONE_COLOR[b.gem], 0.04);
  }
  const flick = s.portalOpen && !s.reduced && Math.floor(s.t / 200) % 2 === 1 ? 0.01 : 0;
  light(g, PORTAL_RECT.x + 24, PORTAL_RECT.y + 30, s.portalOpen ? 36 : 22, s.portalOpen ? "#3ef0ff" : "#9b6bff", (s.portalOpen ? 0.05 : 0.025) + flick);
  g.globalCompositeOperation = "source-over";
}
