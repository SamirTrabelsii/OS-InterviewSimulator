// Salle du Portail : Socket.IO + règles de src/engine/portal.ts.
//
// Ce module est chargé par server.ts, hors de Next : pas de `server-only`,
// et aucune dépendance directe à la base ni au bac à sable (tout passe par
// `PortalDeps`, branché dans boot.ts et simulé dans les tests).
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import {
  applyCode,
  buildView,
  CHAT_COOLDOWN_MS,
  CHAT_KEEP,
  normalizeChat,
  type ChatMessage,
  claimDriver,
  denyHand,
  driverAbsentLongEnough,
  expireRequest,
  grantHand,
  MAX_RUN_LOG_LINES,
  PORTAL_RUN_COOLDOWN_MS,
  portalPhase,
  reconcileActive,
  requestHand,
  roleOf,
  takeOver,
  canWrite,
  type PortalPhase,
  type PortalStage,
  type PortalView,
  type RoomCore,
  type RoomResult,
} from "@/engine/portal";
import { deadlineFrom, portalOpenAt, PORTAL_LATEST_MS } from "@/engine/timeline";

// ---------------------------------------------------------------- dépendances

/** Le code du binôme est refusé avant exécution (format, taille) : pas une panne du bac à sable. */
export class GradeRefused extends Error {}

export type Member = { sessionId: string; name: string; gems: string[]; status: string; startedAt: Date | null };
export type SlotInfo = {
  slotId: string;
  scenario: string;
  seed: bigint;
  /** Session dont le sujet figé fournit le Portail du créneau (la 1re du créneau). */
  subjectSessionId?: string;
  t0: Date | null; members: Member[]; callUrl?: string | null };

export type PersistedRoom = { code: string; epoch: number; driverSessionId: string | null; openedAt: Date | null; solvedAt: Date | null };

export type GradeOutcome = { passed: number; total: number; logLines: string[]; publicError?: string; detail: Record<string, unknown> };

type Actor = "candidat" | "systeme" | "recruteur";
export type JournalEvent = { type: string; payload?: Record<string, unknown> };

export interface PortalDeps {
  now(): Date;
  /** Session du cookie candidat → créneau (null si le cookie est invalide). */
  sessionFromCookie(cookieHeader: string | undefined): string | null;
  /** Jeton d'observation recruteur → créneau (null si invalide ou expiré). */
  slotFromObserverToken(token: unknown): string | null;
  slotOfSession(sessionId: string): Promise<SlotInfo | null>;
  slot(slotId: string): Promise<SlotInfo | null>;
  /** Partie PUBLIQUE du Portail du créneau (code cassé, logs, ticket…). */
  stage(info: SlotInfo): PortalStage;
  /** Valide le code dans le bac à sable (lève si le bac à sable est indisponible). */
  grade(info: SlotInfo, code: string, now: Date): Promise<GradeOutcome>;
  loadRoom(slotId: string): Promise<PersistedRoom | null>;
  /** Derniers messages du chat de secours (relus du journal quand la salle est rechargée). */
  loadChat?(slotId: string): Promise<ChatMessage[]>;
  saveRoom(slotId: string, patch: Partial<PersistedRoom>): Promise<void>;
  journal(sessionId: string, actor: Actor, events: JournalEvent[], at: Date): Promise<void>;
  log?(message: string, err?: unknown): void;
}

// ---------------------------------------------------------------- réglages

export const TICK_MS = 1000;
const INFO_REFRESH_MS = 3000;
const FLUSH_MS = 1500;
const SNAPSHOT_MS = 5000;
const IDLE_DISPOSE_MS = 2 * 60_000;

// ---------------------------------------------------------------- état vivant

type Presence = { socket: Socket; since: number };

class LiveRoom {
  core: RoomCore;
  openedAt: Date | null;
  solvedAt: Date | null;
  runLogs: string[] = [];
  result: RoomResult | null = null;
  running = false;
  lastRunAt: number | null = null;
  lastRequestAt = new Map<string, number>();
  online = new Map<string, Presence>();
  offlineSince = new Map<string, number>();
  observers = new Set<Socket>();
  dirty = false;
  lastFlushAt = 0;
  lastSnapshotAt = 0;
  lastSnapshotCode: string;
  infoAt = 0;
  idleSince: number | null = null;
  ended = false;
  lastActiveKey = "";
  lastCanTakeOver = false;
  chat: ChatMessage[] = [];
  chatSeq = 0;
  lastChatAt = new Map<string, number>();

  constructor(
    public info: SlotInfo,
    persisted: PersistedRoom | null,
    initialCode: string,
  ) {
    this.core = {
      code: persisted?.code || initialCode,
      epoch: persisted?.epoch ?? 0,
      driverId: persisted?.driverSessionId ?? null,
      request: null,
      solved: persisted?.solvedAt != null,
    };
    this.openedAt = persisted?.openedAt ?? null;
    this.solvedAt = persisted?.solvedAt ?? null;
    this.lastSnapshotCode = this.core.code;
  }

  get active(): string[] {
    return this.info.members.filter((m) => m.status !== "expiree").map((m) => m.sessionId);
  }
}

// ---------------------------------------------------------------- messages

const codeUpdate = z.object({ epoch: z.number().int(), code: z.string() });

type Ack = (r: Record<string, unknown>) => void;
const reply = (ack: unknown, r: Record<string, unknown>) => typeof ack === "function" && (ack as Ack)(r);

type SocketData = { kind: "candidat"; sessionId: string; slotId: string } | { kind: "observateur"; slotId: string };

export class PortalHub {
  readonly io: Server;
  private rooms = new Map<string, LiveRoom>();
  private loading = new Map<string, Promise<LiveRoom | null>>();
  private timer: NodeJS.Timeout;

  constructor(
    httpServer: HttpServer,
    private deps: PortalDeps,
  ) {
    this.io = new Server(httpServer, {
      path: "/socket.io",
      serveClient: false,
      // Next gère ses propres « upgrade » (rechargement à chaud en dev) :
      // Socket.IO ne doit pas détruire ceux qui ne le concernent pas.
      destroyUpgrade: false,
      maxHttpBufferSize: 256 * 1024,
      pingInterval: 5000,
      pingTimeout: 8000,
    });
    this.io.use((socket, next) => {
      this.authenticate(socket).then(
        (data) => {
          socket.data = data;
          next();
        },
        (err: Error) => next(err),
      );
    });
    this.io.on("connection", (socket) => void this.onConnection(socket));
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    for (const room of this.rooms.values()) await this.flush(room, true);
    await this.io.close();
  }

  private log(message: string, err?: unknown) {
    (this.deps.log ?? ((m, e) => console.error(`[portail] ${m}`, e ?? "")))(message, err);
  }

  // ------------------------------------------------------------ connexion

  private async authenticate(socket: Socket): Promise<SocketData> {
    const auth = socket.handshake.auth as { observer?: unknown } | undefined;
    if (auth?.observer !== undefined) {
      const slotId = this.deps.slotFromObserverToken(auth.observer);
      if (!slotId) throw new Error("refuse");
      return { kind: "observateur", slotId };
    }
    const sessionId = this.deps.sessionFromCookie(socket.handshake.headers.cookie);
    if (!sessionId) throw new Error("refuse");
    const info = await this.deps.slotOfSession(sessionId);
    const me = info?.members.find((m) => m.sessionId === sessionId);
    // Il faut avoir démarré sa session, et ne pas avoir été retiré (repli solo).
    if (!info || !me || me.status === "expiree" || !me.startedAt || !info.t0) throw new Error("refuse");
    return { kind: "candidat", sessionId, slotId: info.slotId };
  }

  private async room(slotId: string, info?: SlotInfo): Promise<LiveRoom | null> {
    const existing = this.rooms.get(slotId);
    if (existing) return existing;
    let pending = this.loading.get(slotId);
    if (!pending) {
      pending = (async () => {
        const fresh = info ?? (await this.deps.slot(slotId));
        if (!fresh) return null;
        const persisted = await this.deps.loadRoom(slotId);
        const live = new LiveRoom(fresh, persisted, this.deps.stage(fresh).buggyCode);
        live.chat = ((await this.deps.loadChat?.(slotId)) ?? []).slice(-CHAT_KEEP);
        live.chatSeq = live.chat.reduce((m, c) => Math.max(m, c.id), 0);
        live.infoAt = this.deps.now().getTime();
        this.rooms.set(slotId, live);
        return live;
      })().finally(() => this.loading.delete(slotId));
      this.loading.set(slotId, pending);
    }
    return pending;
  }

  private async onConnection(socket: Socket) {
    const data = socket.data as SocketData;
    try {
      const live = await this.room(data.slotId);
      if (!live) return void socket.disconnect(true);
      const now = this.deps.now();
      live.idleSince = null;

      if (data.kind === "observateur") {
        live.observers.add(socket);
        socket.on("disconnect", () => live.observers.delete(socket));
        // Écritures refusées pour un observateur : on ne branche aucun gestionnaire.
        await this.journalAll(live, "recruteur", [{ type: "portail.observe", payload: {} }], now);
        socket.emit("state", this.viewFor(live, "observateur", null));
        return;
      }

      const { sessionId } = data;
      const previous = live.online.get(sessionId);
      if (previous) {
        // Deuxième onglet ou appareil : il remplace le premier (journalisé).
        previous.socket.emit("replaced");
        previous.socket.disconnect(true);
      }
      live.online.set(sessionId, { socket, since: now.getTime() });
      live.offlineSince.delete(sessionId);

      await this.refreshInfo(live);
      if (this.phase(live) === "ouvert") await this.claim(live, sessionId, now);
      await this.deps.journal(
        sessionId,
        "systeme",
        [{ type: "portail.presence", payload: { state: "connecte", replaced: previous !== undefined } }],
        now,
      );

      this.bind(socket, live, sessionId);
      this.emitState(live);
    } catch (err) {
      this.log("connexion", err);
      socket.disconnect(true);
    }
  }

  private bind(socket: Socket, live: LiveRoom, sessionId: string) {
    socket.on("disconnect", () => {
      if (live.online.get(sessionId)?.socket !== socket) return; // remplacé par un autre onglet
      live.online.delete(sessionId);
      const now = this.deps.now();
      live.offlineSince.set(sessionId, now.getTime());
      void this.flush(live, true);
      void this.deps.journal(sessionId, "systeme", [{ type: "portail.presence", payload: { state: "deconnecte" } }], now).catch((e) => this.log("journal", e));
      this.emitState(live);
    });

    // Toute écriture est revérifiée côté serveur : rôle, époque, phase, taille.
    socket.on("code:update", (msg: unknown, ack?: unknown) => void this.guard(ack, () => this.onCode(live, sessionId, msg, ack)));
    socket.on("run", (_msg: unknown, ack?: unknown) => void this.guard(ack, () => this.onRun(live, sessionId, ack)));
    socket.on("chat:send", (msg: unknown, ack?: unknown) => void this.guard(ack, () => this.onChat(live, sessionId, msg, ack)));
    socket.on("hand:request", (_m: unknown, ack?: unknown) => void this.guard(ack, () => this.onHand(live, sessionId, "request", ack)));
    socket.on("hand:grant", (_m: unknown, ack?: unknown) => void this.guard(ack, () => this.onHand(live, sessionId, "grant", ack)));
    socket.on("hand:deny", (_m: unknown, ack?: unknown) => void this.guard(ack, () => this.onHand(live, sessionId, "deny", ack)));
    socket.on("hand:take", (_m: unknown, ack?: unknown) => void this.guard(ack, () => this.onHand(live, sessionId, "take", ack)));
  }

  private async guard(ack: unknown, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.log("gestionnaire", err);
      reply(ack, { ok: false, reason: "erreur" });
    }
  }

  // ------------------------------------------------------------ état

  private phase(live: LiveRoom): PortalPhase {
    const { t0 } = live.info;
    return portalPhase({
      t0,
      deadline: t0 ? deadlineFrom(t0) : null,
      opened: live.openedAt !== null,
      solved: live.core.solved,
      now: this.deps.now(),
    });
  }

  private viewFor(live: LiveRoom, role: "observateur", viewer: null): PortalView;
  private viewFor(live: LiveRoom, role: null, viewer: string): PortalView | null;
  private viewFor(live: LiveRoom, role: "observateur" | null, viewer: string | null): PortalView | null {
    const now = this.deps.now();
    const { t0 } = live.info;
    const active = live.active;
    const resolved = role ?? (viewer ? roleOf(live.core, viewer, active) : null);
    if (!resolved) return null;
    const players = live.info.members
      .filter((m) => m.status !== "expiree")
      .map((m) => ({ id: m.sessionId, name: m.name, online: live.online.has(m.sessionId), gems: m.gems.length }));
    const driverOffline = live.core.driverId ? (live.offlineSince.get(live.core.driverId) ?? null) : null;
    return buildView({
      role: resolved,
      viewer,
      room: live.core,
      stage: this.deps.stage(live.info),
      runLogs: live.runLogs,
      result: live.result,
      phase: this.phase(live),
      now,
      deadline: t0 ? deadlineFrom(t0) : null,
      opensByLatest: t0 ? new Date(t0.getTime() + PORTAL_LATEST_MS) : null,
      players,
      canTakeOver: driverAbsentLongEnough(driverOffline, now.getTime()),
      callUrl: live.info.callUrl ?? null,
      chat: live.chat,
    });
  }

  private emitState(live: LiveRoom) {
    for (const [sessionId, p] of live.online) {
      const view = this.viewFor(live, null, sessionId);
      if (view) p.socket.emit("state", view);
    }
    if (live.observers.size > 0) {
      const view = this.viewFor(live, "observateur", null);
      for (const s of live.observers) s.emit("state", view);
    }
  }

  private async journalAll(live: LiveRoom, actor: Actor, events: JournalEvent[], at: Date) {
    for (const id of live.active) await this.deps.journal(id, actor, events, at).catch((e) => this.log("journal", e));
  }

  private async persistCore(live: LiveRoom, extra: Partial<PersistedRoom> = {}) {
    await this.deps.saveRoom(live.info.slotId, {
      code: live.core.code,
      epoch: live.core.epoch,
      driverSessionId: live.core.driverId,
      ...extra,
    });
    live.dirty = false;
    live.lastFlushAt = this.deps.now().getTime();
  }

  private async flush(live: LiveRoom, force = false) {
    if (!live.dirty) return;
    if (!force && this.deps.now().getTime() - live.lastFlushAt < FLUSH_MS) return;
    try {
      await this.persistCore(live);
    } catch (err) {
      this.log("enregistrement de la salle", err);
    }
  }

  private async refreshInfo(live: LiveRoom) {
    const fresh = await this.deps.slot(live.info.slotId);
    live.infoAt = this.deps.now().getTime();
    if (!fresh) return;
    live.info = fresh;
    const key = live.active.join(",");
    if (key !== live.lastActiveKey) {
      // Repli solo : le candidat retiré n'a plus de rôle ; le restant prend le clavier.
      if (live.lastActiveKey !== "") {
        const next = reconcileActive(live.core, live.active);
        if (next !== live.core) {
          live.core = next;
          await this.persistCore(live);
        }
        for (const [id, p] of live.online) {
          if (!live.active.includes(id)) {
            p.socket.emit("retire");
            p.socket.disconnect(true);
            live.online.delete(id);
          }
        }
      }
      live.lastActiveKey = key;
    }
    await this.maybeOpen(live);
  }

  /** Ouvre le Portail dès que tous les candidats actifs ont leurs 4 gemmes, au plus tard à T0 + 33 min. */
  private async maybeOpen(live: LiveRoom) {
    const { t0 } = live.info;
    if (live.openedAt || !t0) return;
    const now = this.deps.now();
    if (now.getTime() >= deadlineFrom(t0).getTime()) return;
    const active = live.info.members.filter((m) => m.status !== "expiree");
    const at = portalOpenAt(t0, active.map((m) => m.gems), now);
    if (!at) return;
    live.openedAt = at;
    await this.persistCore(live, { openedAt: at });
    const missing = Object.fromEntries(
      active.map((m) => [m.sessionId, ["quiz", "sql", "algo", "logique"].filter((g) => !m.gems.includes(g))]).filter(([, g]) => (g as string[]).length > 0),
    );
    await this.journalAll(live, "systeme", [{ type: "portail.open", payload: { at: at.toISOString(), forced: at.getTime() < now.getTime() || Object.keys(missing).length > 0, missingGems: missing } }], now);
  }

  private async claim(live: LiveRoom, sessionId: string, now: Date) {
    const next = claimDriver(live.core, sessionId, live.active);
    if (next === live.core) return;
    live.core = next;
    await this.persistCore(live);
    await this.deps.journal(sessionId, "systeme", [{ type: "portail.role", payload: { role: "pilote", epoch: next.epoch, reason: "premier-arrive" } }], now);
  }

  // ------------------------------------------------------------ actions

  private async onCode(live: LiveRoom, sessionId: string, msg: unknown, ack: unknown) {
    const parsed = codeUpdate.safeParse(msg);
    if (!parsed.success) return void reply(ack, { ok: false, reason: "invalide" });
    if (this.phase(live) !== "ouvert") return void reply(ack, { ok: false, reason: "ferme" });
    const res = applyCode(live.core, sessionId, parsed.data.epoch, parsed.data.code, live.active);
    if (!res.ok) {
      this.deps.journal(sessionId, "systeme", [{ type: "portail.refus", payload: { action: "code", reason: res.reason } }], this.deps.now()).catch(() => {});
      // L'auteur est en retard d'une époque : on lui renvoie sa vue à jour.
      if (res.reason === "epoque" || res.reason === "lecture-seule") {
        const view = this.viewFor(live, null, sessionId);
        if (view) live.online.get(sessionId)?.socket.emit("state", view);
      }
      return void reply(ack, { ok: false, reason: res.reason });
    }
    live.core = res.room;
    live.dirty = true;
    for (const s of live.observers) s.emit("code", { code: live.core.code, epoch: live.core.epoch });
    reply(ack, { ok: true });
  }

  private async onRun(live: LiveRoom, sessionId: string, ack: unknown) {
    const now = this.deps.now();
    if (this.phase(live) !== "ouvert") return void reply(ack, { ok: false, reason: "ferme" });
    if (!canWrite(roleOf(live.core, sessionId, live.active))) return void reply(ack, { ok: false, reason: "lecture-seule" });
    if (live.running) return void reply(ack, { ok: false, reason: "en-cours" });
    if (live.lastRunAt !== null && now.getTime() - live.lastRunAt < PORTAL_RUN_COOLDOWN_MS) {
      return void reply(ack, { ok: false, reason: "trop-tot", retryAfterMs: PORTAL_RUN_COOLDOWN_MS - (now.getTime() - live.lastRunAt) });
    }
    live.running = true;
    live.lastRunAt = now.getTime();
    const code = live.core.code;
    const epoch = live.core.epoch;
    try {
      await this.flush(live, true);
      await this.deps.journal(sessionId, "candidat", [{ type: "portail.run", payload: { code, epoch } }], now);
      let grade: GradeOutcome;
      try {
        grade = await this.deps.grade(live.info, code, now);
      } catch (err) {
        if (err instanceof GradeRefused) return void reply(ack, { ok: false, reason: "invalide", message: err.message });
        this.log("validation", err);
        return void reply(ack, { ok: false, reason: "occupe" });
      }
      const done = this.deps.now();
      if (this.phase(live) !== "ouvert") {
        // Le temps est écoulé (ou la salle résolue) pendant l'exécution : résultat ignoré.
        await this.deps.journal(sessionId, "systeme", [{ type: "portail.result.ignore", payload: { passed: grade.passed, total: grade.total } }], done);
        return void reply(ack, { ok: false, reason: "termine" });
      }
      const ok = grade.passed === grade.total;
      live.result = { passed: grade.passed, total: grade.total, ...(grade.publicError ? { error: grade.publicError } : {}), at: done.toISOString() };
      live.runLogs = [...live.runLogs, ...grade.logLines].slice(-MAX_RUN_LOG_LINES);
      const events: JournalEvent[] = [{ type: "portail.result", payload: { ...grade.detail, passed: grade.passed, total: grade.total } }];
      if (ok) {
        live.core = { ...live.core, solved: true };
        live.solvedAt = done;
        await this.persistCore(live, { solvedAt: done });
        events.push({ type: "portail.solved", payload: { epoch } });
      }
      await this.journalAll(live, "systeme", events, done);
      this.emitState(live);
      reply(ack, { ok: true, passed: grade.passed, total: grade.total, solved: ok });
    } finally {
      live.running = false;
    }
  }

  /** Chat de secours : binôme seulement, limité en taille et en cadence, journalisé pour le replay. */
  private async onChat(live: LiveRoom, sessionId: string, msg: unknown, ack: unknown) {
    const now = this.deps.now();
    if (this.phase(live) === "termine") return void reply(ack, { ok: false, reason: "termine" });
    const members = live.info.members.filter((m) => m.status !== "expiree");
    const me = members.find((m) => m.sessionId === sessionId);
    if (!me || members.length < 2) return void reply(ack, { ok: false, reason: "pas-de-binome" });
    const text = normalizeChat((msg as { text?: unknown } | null)?.text);
    if (text === null) return void reply(ack, { ok: false, reason: "invalide" });
    const last = live.lastChatAt.get(sessionId);
    if (last !== undefined && now.getTime() - last < CHAT_COOLDOWN_MS) return void reply(ack, { ok: false, reason: "trop-tot" });
    live.lastChatAt.set(sessionId, now.getTime());
    live.chat = [...live.chat, { id: ++live.chatSeq, from: sessionId, name: me.name, text, at: now.toISOString() }].slice(-CHAT_KEEP);
    await this.deps.journal(sessionId, "candidat", [{ type: "portail.chat", payload: { text } }], now);
    this.emitState(live);
    reply(ack, { ok: true });
  }

  private async onHand(live: LiveRoom, sessionId: string, action: "request" | "grant" | "deny" | "take", ack: unknown) {
    const now = this.deps.now();
    if (this.phase(live) !== "ouvert") return void reply(ack, { ok: false, reason: "ferme" });
    const nowMs = now.getTime();
    const active = live.active;
    const before = live.core;
    let res;
    switch (action) {
      case "request":
        res = requestHand(before, sessionId, active, nowMs, live.lastRequestAt.get(sessionId) ?? null);
        if (res.ok) live.lastRequestAt.set(sessionId, nowMs);
        break;
      case "grant":
        res = grantHand(before, sessionId, active);
        break;
      case "deny":
        res = denyHand(before, sessionId, active);
        break;
      case "take":
        res = takeOver(before, sessionId, active, before.driverId ? (live.offlineSince.get(before.driverId) ?? null) : null, nowMs);
        break;
    }
    if (!res.ok) {
      await this.deps.journal(sessionId, "systeme", [{ type: "portail.refus", payload: { action: `main.${action}`, reason: res.reason } }], now);
      return void reply(ack, { ok: false, reason: res.reason });
    }
    live.core = res.room;
    const swapped = res.room.epoch !== before.epoch;
    if (swapped) await this.persistCore(live); // code compris : le nouveau pilote repart du dernier état
    const event: Record<typeof action, string> = {
      request: "portail.main.demande",
      grant: "portail.main.accord",
      deny: "portail.main.refus",
      take: "portail.main.prise",
    };
    await this.deps.journal(
      sessionId,
      "candidat",
      [{ type: event[action], payload: { from: before.driverId, to: res.room.driverId, epoch: res.room.epoch } }],
      now,
    );
    this.emitState(live);
    reply(ack, { ok: true });
  }

  // ------------------------------------------------------------ horloge

  /** Une fois par seconde : fin du temps, ouverture, demandes expirées, sauvegardes. */
  async tick(): Promise<void> {
    for (const live of [...this.rooms.values()]) {
      try {
        await this.tickRoom(live);
      } catch (err) {
        this.log("tick", err);
      }
    }
  }

  private async tickRoom(live: LiveRoom) {
    const nowDate = this.deps.now();
    const now = nowDate.getTime();
    const { t0 } = live.info;

    if (t0 && now >= deadlineFrom(t0).getTime()) {
      if (!live.ended) {
        live.ended = true;
        await this.flush(live, true);
        await this.snapshot(live, nowDate, true);
        await this.journalAll(live, "systeme", [{ type: "portail.end", payload: { solved: live.core.solved, result: live.result } }], nowDate);
        this.emitState(live);
      }
      if (live.online.size === 0 && live.observers.size === 0) this.rooms.delete(live.info.slotId);
      return;
    }

    if (now - live.infoAt >= INFO_REFRESH_MS) {
      const wasOpen = live.openedAt !== null;
      const key = live.active.join(",");
      await this.refreshInfo(live);
      if (!wasOpen && live.openedAt) {
        for (const id of live.online.keys()) await this.claim(live, id, nowDate);
        this.emitState(live);
      } else if (key !== live.lastActiveKey) {
        this.emitState(live);
      }
    }

    const expired = expireRequest(live.core, now);
    if (expired !== live.core) {
      live.core = expired;
      this.emitState(live);
    }

    // Le droit de « prendre la main » apparaît au bout de 20 s d'absence du pilote.
    const driverOffline = live.core.driverId ? (live.offlineSince.get(live.core.driverId) ?? null) : null;
    const canTake = driverAbsentLongEnough(driverOffline, now);
    if (canTake !== live.lastCanTakeOver) {
      live.lastCanTakeOver = canTake;
      this.emitState(live);
    }

    await this.flush(live);
    await this.snapshot(live, nowDate, false);

    if (live.online.size === 0 && live.observers.size === 0) {
      live.idleSince ??= now;
      if (now - live.idleSince >= IDLE_DISPOSE_MS) {
        await this.flush(live, true);
        this.rooms.delete(live.info.slotId);
      }
    } else live.idleSince = null;
  }

  /** Instantané du code toutes les ~5 s quand il change (replay). */
  private async snapshot(live: LiveRoom, at: Date, force: boolean) {
    if (live.core.code === live.lastSnapshotCode) return;
    if (!force && at.getTime() - live.lastSnapshotAt < SNAPSHOT_MS) return;
    live.lastSnapshotAt = at.getTime();
    live.lastSnapshotCode = live.core.code;
    const driver = live.core.driverId;
    if (driver) await this.deps.journal(driver, "candidat", [{ type: "code.snapshot", payload: { stage: "portail", code: live.core.code, epoch: live.core.epoch } }], at);
  }
}

export function attachPortal(httpServer: HttpServer, deps: PortalDeps): PortalHub {
  return new PortalHub(httpServer, deps);
}
