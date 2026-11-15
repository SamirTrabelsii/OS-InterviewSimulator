import { BUILDING_IDS, makeBuilding, type BuildingArt, type BuildingId } from "./buildings";
import { makeSteam, makeSparks } from "./fx";
import { makeGround } from "./ground";
import { IDLE_FRAMES, WALK_FRAMES, makeBip, makeGem, makePlayer, type Dir, type GemKind } from "./hero";
import { PORTAL_FRAMES, makePortal } from "./portal";
import type { Pix } from "./pix";
import { makeProps } from "./props";

export interface Art {
  ground: Record<string, Pix>;
  props: Record<string, Pix>;
  buildings: Record<BuildingId, BuildingArt>;
  portal: { closed: Pix[]; charging: Pix[]; open: Pix[] };
  player: Record<Dir, { idle: Pix[]; walk: Pix[] }>;
  gems: Record<GemKind, Pix[]>;
  bip: Pix[];
  steam: Pix[];
  sparks: Pix[];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const DIRS: Dir[] = ["down", "up", "left", "right"];
export const GEM_KINDS: GemKind[] = ["quiz", "sql", "algo", "logique"];

let cache: Art | null = null;

/** Génère (une seule fois) toute la planche. Pur : fonctionne aussi sous Node, pour les tests. */
export function getArt(): Art {
  cache ??= {
    ground: makeGround(),
    props: makeProps(),
    buildings: Object.fromEntries(BUILDING_IDS.map((id) => [id, makeBuilding(id)])) as Record<BuildingId, BuildingArt>,
    portal: {
      closed: range(PORTAL_FRAMES.closed).map((f) => makePortal("closed", f)),
      charging: range(PORTAL_FRAMES.charging).map((f) => makePortal("charging", f)),
      open: range(PORTAL_FRAMES.open).map((f) => makePortal("open", f)),
    },
    player: Object.fromEntries(
      DIRS.map((d) => [d, { idle: range(IDLE_FRAMES).map((f) => makePlayer(d, "idle", f)), walk: range(WALK_FRAMES).map((f) => makePlayer(d, "walk", f)) }]),
    ) as Art["player"],
    gems: Object.fromEntries(GEM_KINDS.map((k) => [k, range(4).map((f) => makeGem(k, f))])) as Art["gems"],
    bip: range(4).map(makeBip),
    steam: range(6).map(makeSteam),
    sparks: range(4).map(makeSparks),
  };
  return cache;
}

export { BUILDING_IDS };
export type { BuildingId, Dir, GemKind };
