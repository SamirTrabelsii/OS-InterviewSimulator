// Règles du Portail en binôme (docs/ARCHITECTURE.md § 3.3). Fonctions pures :
// l'heure est toujours passée en paramètre, aucune entrée/sortie ici.
//
// Le serveur Socket.IO (src/server/portal) n'est qu'un transport autour de
// ces règles. `buildView` est la SEULE fonction qui décide ce que chaque
// rôle reçoit : le copilote ne voit jamais le code, le pilote jamais les
// logs ni le contexte client.
import type { PublicInstance } from "./content/schemas";

export const HAND_REQUEST_TTL_MS = 30_000;
export const HAND_REQUEST_COOLDOWN_MS = 5_000;
/** Le copilote peut prendre la main si le pilote est hors ligne depuis ce délai. */
export const DRIVER_ABSENT_TAKEOVER_MS = 20_000;
export const PORTAL_RUN_COOLDOWN_MS = 3_000;
export const MAX_PORTAL_CODE_CHARS = 50_000;
export const MAX_RUN_LOG_LINES = 200;

export type Role = "pilote" | "copilote" | "solo" | "observateur";
export type PortalPhase = "ferme" | "ouvert" | "resolu" | "termine";

export type HandRequest = { from: string; at: number };

/** État de la salle qui décide des droits (une partie est persistée). */
export type RoomCore = {
  code: string;
  /** Change à chaque passage de main : une écriture d'un ancien pilote est refusée. */
  epoch: number;
  driverId: string | null;
  request: HandRequest | null;
  solved: boolean;
};

export type RoomResult = { passed: number; total: number; error?: string; at: string };

type Ok = { ok: true; room: RoomCore };
type Refused = { ok: false; reason: string };

// ---------------------------------------------------------------- rôles et droits

/** `active` : sessions qui participent au Portail (un partenaire retiré en solo n'y figure plus). */
export function roleOf(room: RoomCore, sessionId: string, active: readonly string[]): Role | null {
  if (!active.includes(sessionId)) return null;
  if (active.length === 1) return "solo";
  return room.driverId === sessionId ? "pilote" : "copilote";
}

export const canWrite = (role: Role | null) => role === "pilote" || role === "solo";

/** Premier candidat connecté (ou seul candidat restant) : il prend le clavier. */
export function claimDriver(room: RoomCore, sessionId: string, active: readonly string[]): RoomCore {
  if (!active.includes(sessionId)) return room;
  if (room.driverId && active.includes(room.driverId)) return room;
  return { ...room, driverId: sessionId, epoch: room.epoch + 1, request: null };
}

export function applyCode(room: RoomCore, by: string, epoch: number, code: string, active: readonly string[]): Ok | Refused {
  if (room.solved) return { ok: false, reason: "resolu" };
  if (!canWrite(roleOf(room, by, active))) return { ok: false, reason: "lecture-seule" };
  if (epoch !== room.epoch) return { ok: false, reason: "epoque" };
  if (code.length > MAX_PORTAL_CODE_CHARS) return { ok: false, reason: "trop-long" };
  return { ok: true, room: { ...room, code } };
}

// ---------------------------------------------------------------- passage de main

/** Le copilote demande la main ; une seule demande à la fois, espacées d'au moins 5 s. */
export function requestHand(room: RoomCore, from: string, active: readonly string[], nowMs: number, lastRequestAtMs: number | null): Ok | Refused {
  if (roleOf(room, from, active) !== "copilote") return { ok: false, reason: "pas-copilote" };
  if (room.solved) return { ok: false, reason: "resolu" };
  if (room.request) return { ok: false, reason: "deja-demandee" };
  if (lastRequestAtMs !== null && nowMs - lastRequestAtMs < HAND_REQUEST_COOLDOWN_MS) return { ok: false, reason: "trop-tot" };
  return { ok: true, room: { ...room, request: { from, at: nowMs } } };
}

function swap(room: RoomCore, to: string): RoomCore {
  return { ...room, driverId: to, epoch: room.epoch + 1, request: null };
}

/** Le pilote accepte la demande : les rôles (et donc les vues) s'échangent. */
export function grantHand(room: RoomCore, by: string, active: readonly string[]): Ok | Refused {
  if (roleOf(room, by, active) !== "pilote") return { ok: false, reason: "pas-pilote" };
  if (!room.request || !active.includes(room.request.from)) return { ok: false, reason: "aucune-demande" };
  return { ok: true, room: swap(room, room.request.from) };
}

export function denyHand(room: RoomCore, by: string, active: readonly string[]): Ok | Refused {
  if (roleOf(room, by, active) !== "pilote") return { ok: false, reason: "pas-pilote" };
  if (!room.request) return { ok: false, reason: "aucune-demande" };
  return { ok: true, room: { ...room, request: null } };
}

/** Une demande sans réponse expire après 30 s. */
export function expireRequest(room: RoomCore, nowMs: number): RoomCore {
  return room.request && nowMs - room.request.at >= HAND_REQUEST_TTL_MS ? { ...room, request: null } : room;
}

/** Le pilote est parti depuis assez longtemps pour que le copilote prenne la main sans accord. */
export function driverAbsentLongEnough(offlineSinceMs: number | null, nowMs: number): boolean {
  return offlineSinceMs !== null && nowMs - offlineSinceMs >= DRIVER_ABSENT_TAKEOVER_MS;
}

export function takeOver(room: RoomCore, by: string, active: readonly string[], driverOfflineSinceMs: number | null, nowMs: number): Ok | Refused {
  if (roleOf(room, by, active) !== "copilote") return { ok: false, reason: "pas-copilote" };
  if (!driverAbsentLongEnough(driverOfflineSinceMs, nowMs)) return { ok: false, reason: "pilote-present" };
  return { ok: true, room: swap(room, by) };
}

/** Après un passage en solo : si le pilote a été retiré, le candidat restant prend le clavier. */
export function reconcileActive(room: RoomCore, active: readonly string[]): RoomCore {
  if (active.length === 0) return room;
  const request = room.request && active.includes(room.request.from) ? room.request : null;
  if (room.driverId && active.includes(room.driverId)) return request === room.request ? room : { ...room, request };
  return { ...room, driverId: active[0], epoch: room.epoch + 1, request: null };
}

// ---------------------------------------------------------------- phase

export function portalPhase(input: { t0: Date | null; deadline: Date | null; opened: boolean; solved: boolean; now: Date }): PortalPhase {
  if (!input.t0 || !input.deadline) return "ferme";
  if (input.now.getTime() >= input.deadline.getTime()) return "termine";
  if (input.solved) return "resolu";
  return input.opened ? "ouvert" : "ferme";
}

// ---------------------------------------------------------------- vues asymétriques

export type PortalStage = PublicInstance["stages"]["portail"];

export type PlayerInfo = { id: string; name: string; online: boolean };

export type PortalView = {
  phase: PortalPhase;
  role: Role;
  epoch: number;
  serverNow: string;
  deadline: string | null;
  /** Le Portail s'ouvre au plus tard à cet instant (T0 + 33 min). */
  opensByLatest: string | null;
  title: string;
  story: string;
  partner: { name: string; online: boolean } | null;
  hand: "aucune" | "envoyee" | "recue";
  canTakeOver: boolean;
  result: RoomResult | null;
  /** Pilote, solo, observateur. */
  code?: string;
  functionName?: string;
  /** Copilote, solo, observateur. */
  logs?: string[];
  clientContext?: string;
  statement?: string;
  examples?: PortalStage["examples"];
  /** Observateur seulement. */
  players?: (PlayerInfo & { role: Role })[];
};

export type ViewInput = {
  role: Role;
  /** Session qui regarde (inutile pour l'observateur). */
  viewer: string | null;
  room: RoomCore;
  stage: PortalStage;
  runLogs: readonly string[];
  result: RoomResult | null;
  phase: PortalPhase;
  now: Date;
  deadline: Date | null;
  opensByLatest: Date | null;
  players: readonly PlayerInfo[];
  canTakeOver: boolean;
};

/**
 * Construit la vue d'un rôle. Chaque champ n'est ajouté que si ce rôle y
 * a droit ; le reste n'existe tout simplement pas dans l'objet envoyé.
 */
export function buildView(i: ViewInput): PortalView {
  const { role, room, stage } = i;
  const open = i.phase === "ouvert" || i.phase === "resolu";
  const partner = i.viewer ? i.players.find((p) => p.id !== i.viewer) : undefined;
  const view: PortalView = {
    phase: i.phase,
    role,
    epoch: room.epoch,
    serverNow: i.now.toISOString(),
    deadline: i.deadline?.toISOString() ?? null,
    opensByLatest: i.opensByLatest?.toISOString() ?? null,
    title: stage.title,
    story: stage.story,
    partner: role === "observateur" || !partner ? null : { name: partner.name, online: partner.online },
    hand: !room.request ? "aucune" : room.request.from === i.viewer ? "envoyee" : role === "pilote" ? "recue" : "aucune",
    canTakeOver: role === "copilote" && i.canTakeOver,
    result: open ? i.result : null,
  };
  if (!open) return view;

  const seesCode = role === "pilote" || role === "solo" || role === "observateur";
  const seesContext = role === "copilote" || role === "solo" || role === "observateur";
  if (seesCode) {
    view.code = room.code;
    view.functionName = stage.signature.functionName;
  }
  if (seesContext) {
    view.logs = [...stage.logs, ...i.runLogs].slice(-MAX_RUN_LOG_LINES);
    view.clientContext = stage.clientContext;
    view.statement = stage.statement;
    view.examples = stage.examples;
  }
  if (role === "observateur") {
    view.players = i.players.map((p) => ({ ...p, role: roleOf(room, p.id, i.players.map((x) => x.id)) ?? "copilote" }));
  }
  return view;
}
