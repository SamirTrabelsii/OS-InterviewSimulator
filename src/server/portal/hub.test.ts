// Tests d'intégration du Portail : vrai serveur HTTP + Socket.IO, vrais
// clients `socket.io-client`, base et bac à sable simulés (voir `deps`).
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PortalStage, PortalView } from "@/engine/portal";
import { encodeCandidateCookie, CANDIDATE_COOKIE } from "@/server/candidate/cookie";
import { GradeRefused, PortalHub, type JournalEvent, type PersistedRoom, type PortalDeps, type SlotInfo } from "./hub";
import { issueObserverToken, verifyObserverToken } from "./observer-token";
import { sessionFromCookie } from "./pg";

process.env.AUTH_SECRET ??= "secret-de-test-suffisamment-long";

const SLOT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333"; // session d'un autre créneau
const T0 = new Date("2026-12-01T09:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const ALL = ["quiz", "sql", "algo", "logique"];

const BUGGY = "def corriger(x):\n    return BUG\n";
const stage: PortalStage = {
  title: "Le Portail",
  story: "Histoire",
  statement: "ENONCE-TICKET",
  signature: { functionName: "corriger", params: ["x"] },
  buggyCode: BUGGY,
  examples: [{ args: [1], expected: 1 }],
  logs: ["06:00:01 INFO LOG-INITIAL"],
  clientContext: "CONTEXTE-CLIENT",
};

type Harness = Awaited<ReturnType<typeof setup>>;

async function setup(opts: { gems?: { a: string[]; b: string[] }; initialRoom?: PersistedRoom | null; nowMin?: number } = {}) {
  const state = {
    now: at(opts.nowMin ?? 10),
    members: [
      { sessionId: A, name: "Ana", gems: opts.gems?.a ?? ALL, status: "en_cours", startedAt: T0 },
      { sessionId: B, name: "Bo", gems: opts.gems?.b ?? ALL, status: "en_cours", startedAt: T0 },
    ] as SlotInfo["members"],
    t0: T0 as Date | null,
    room: opts.initialRoom ?? (null as PersistedRoom | null),
    journal: [] as { sessionId: string; actor: string; type: string; payload?: Record<string, unknown> }[],
    graded: [] as string[],
  };
  const info = (): SlotInfo => ({ slotId: SLOT, scenario: "test", seed: 1n, t0: state.t0, members: state.members.map((m) => ({ ...m })) });
  const deps: PortalDeps = {
    now: () => state.now,
    sessionFromCookie,
    slotFromObserverToken: (t) => verifyObserverToken(t, state.now),
    slotOfSession: async (id) => (state.members.some((m) => m.sessionId === id) ? info() : null),
    slot: async (id) => (id === SLOT ? info() : null),
    stage: () => stage,
    grade: async (_i, code) => {
      state.graded.push(code);
      if (code.length > 1000) throw new GradeRefused("Code trop long");
      const passed = code.includes("FIXED") ? 9 : code.includes("MOITIE") ? 5 : 2;
      return { passed, total: 9, logLines: [`06:30:00 INFO exemple 1 : obtenu ${passed}`, `06:30:00 INFO vérifications : ${passed} / 9`], detail: { cases: [] } };
    },
    loadRoom: async () => state.room,
    saveRoom: async (_id, patch) => {
      state.room = { code: "", epoch: 0, driverSessionId: null, openedAt: null, solvedAt: null, ...state.room, ...patch };
    },
    journal: async (sessionId, actor, events: JournalEvent[]) => {
      for (const e of events) state.journal.push({ sessionId, actor, type: e.type, payload: e.payload });
    },
    log: () => {},
  };
  const http: HttpServer = createServer();
  const hub = new PortalHub(http, deps);
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  const sockets: Socket[] = [];

  /** Connexion d'un candidat (cookie signé) ; résout avec la socket et son premier état. */
  const client = (sessionId: string | null, extra: Record<string, unknown> = {}) => {
    const cookie = sessionId ? `${CANDIDATE_COOKIE}=${encodeCandidateCookie({ sessionId, deviceId: "d" })}` : "";
    const socket = connect(url, { transports: ["websocket"], reconnection: false, forceNew: true, extraHeaders: cookie ? { cookie } : {}, ...extra });
    sockets.push(socket);
    const states: PortalView[] = [];
    socket.on("state", (s: PortalView) => states.push(s));
    return { socket, states };
  };
  const waitFor = async <T>(fn: () => T | undefined | false, ms = 2000): Promise<T> => {
    const start = Date.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() - start > ms) throw new Error("délai dépassé");
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  const ready = async (c: { states: PortalView[] }) => waitFor(() => c.states.at(-1));
  const call = (s: Socket, event: string, payload?: unknown) =>
    new Promise<Record<string, unknown>>((resolve) => s.timeout(500).emit(event, payload, (err: Error | null, res: Record<string, unknown>) => resolve(err ? { timeout: true } : res)));
  const refused = (c: { socket: Socket }) => new Promise<string>((resolve) => c.socket.once("connect_error", (e) => resolve(e.message)));
  const close = async () => {
    for (const s of sockets) s.close();
    await hub.close();
    http.closeAllConnections();
  };
  return { state, hub, client, ready, waitFor, call, refused, close, url };
}

let h: Harness;
afterEach(async () => h?.close());

describe("authentification du socket", () => {
  beforeEach(async () => (h = await setup()));

  it("refuse un socket sans cookie, avec un cookie falsifié, ou d'une session inconnue", async () => {
    const none = h.client(null);
    expect(await h.refused(none)).toBe("refuse");
    const forged = connect(h.url, { transports: ["websocket"], reconnection: false, forceNew: true, extraHeaders: { cookie: `${CANDIDATE_COOKIE}=${A}.d.signature-bidon` } });
    expect(await new Promise((r) => forged.once("connect_error", (e) => r(e.message)))).toBe("refuse");
    forged.close();
    const stranger = h.client(C);
    expect(await h.refused(stranger)).toBe("refuse");
  });

  it("refuse un candidat qui n'a pas démarré", async () => {
    h.state.members[1].startedAt = null;
    expect(await h.refused(h.client(B))).toBe("refuse");
  });

  it("refuse un jeton d'observateur invalide, expiré ou falsifié", async () => {
    const bad = (token: unknown) => connect(h.url, { transports: ["websocket"], reconnection: false, forceNew: true, auth: { observer: token } });
    for (const token of ["n'importe quoi", issueObserverToken(SLOT, new Date(h.state.now.getTime() - 10 * 60_000)), issueObserverToken(SLOT, h.state.now).replace(/.$/, "x"), 42]) {
      const s = bad(token);
      expect(await new Promise((r) => s.once("connect_error", (e) => r(e.message)))).toBe("refuse");
      s.close();
    }
  });
});



/** Connecte A puis B et attend leurs états. */
async function pair() {
  const a = h.client(A);
  const sa = await h.ready(a);
  const b = h.client(B);
  const sb = await h.ready(b);
  return { a, b, sa, sb };
}

const later = (ms: number) => (h.state.now = new Date(h.state.now.getTime() + ms));

describe("pilote et copilote", () => {
  beforeEach(async () => (h = await setup()));

  it("le premier arrivé pilote ; vues asymétriques filtrées côté serveur", async () => {
    const { a, b, sa, sb } = await pair();
    expect(sa.role).toBe("pilote");
    expect(sb.role).toBe("copilote");
    expect(sa.phase).toBe("ouvert");
    // Pilote : code, jamais logs / contexte / énoncé.
    expect(sa.code).toBe(BUGGY);
    const ja = JSON.stringify(sa);
    for (const secret of ["CONTEXTE-CLIENT", "LOG-INITIAL", "ENONCE-TICKET"]) expect(ja).not.toContain(secret);
    // Copilote : logs et contexte, jamais le code.
    expect(sb.logs).toContain("06:00:01 INFO LOG-INITIAL");
    expect(sb.clientContext).toBe("CONTEXTE-CLIENT");
    expect(JSON.stringify(sb)).not.toContain("BUG");
    expect(sb.code).toBeUndefined();
    // Le pilote voit son partenaire en ligne dès que B arrive, puis hors ligne.
    await h.waitFor(() => a.states.at(-1)?.partner?.online);
    b.socket.close();
    await h.waitFor(() => a.states.at(-1)?.partner?.online === false);
  });

  it("un seul peut écrire : le copilote est refusé, le code du pilote est conservé", async () => {
    const { a, b, sa } = await pair();
    expect(await h.call(b.socket, "code:update", { epoch: sa.epoch, code: "PIRATE" })).toMatchObject({ ok: false, reason: "lecture-seule" });
    expect(await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "x = 1" })).toEqual({ ok: true });
    expect(await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "x".repeat(60_000) })).toMatchObject({ ok: false, reason: "trop-long" });
    expect(await h.call(a.socket, "code:update", { epoch: sa.epoch + 5, code: "y" })).toMatchObject({ ok: false, reason: "epoque" });
    expect(await h.call(a.socket, "code:update", "pas un objet")).toMatchObject({ ok: false, reason: "invalide" });
    expect(h.state.journal.some((e) => e.type === "portail.refus" && e.sessionId === B)).toBe(true);
  });

  it("passage de main : demande, accord, rôles et vues échangés, ancien pilote refusé", async () => {
    const { a, b, sa } = await pair();
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "AVANCEMENT" });

    expect(await h.call(a.socket, "hand:request")).toMatchObject({ ok: false, reason: "pas-copilote" });
    expect(await h.call(b.socket, "hand:request")).toEqual({ ok: true });
    await h.waitFor(() => a.states.at(-1)?.hand === "recue");
    expect(b.states.at(-1)?.hand).toBe("envoyee");
    // Le copilote ne peut pas s'accorder la main lui-même.
    expect(await h.call(b.socket, "hand:grant")).toMatchObject({ ok: false, reason: "pas-pilote" });

    expect(await h.call(a.socket, "hand:grant")).toEqual({ ok: true });
    const nb = await h.waitFor(() => b.states.at(-1)?.role === "pilote" && b.states.at(-1));
    const na = await h.waitFor(() => a.states.at(-1)?.role === "copilote" && a.states.at(-1));
    expect(nb.code).toBe("AVANCEMENT"); // le nouveau pilote repart du dernier état
    expect(na.code).toBeUndefined();
    expect(na.logs).toBeDefined();
    expect(nb.logs).toBeUndefined();
    // L'ancien pilote, même avec son ancienne époque, ne peut plus écrire.
    expect(await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "VIEUX" })).toMatchObject({ ok: false });
    expect(await h.call(b.socket, "code:update", { epoch: nb.epoch, code: "NOUVEAU" })).toEqual({ ok: true });
    expect(h.state.journal.map((e) => e.type)).toEqual(expect.arrayContaining(["portail.main.demande", "portail.main.accord"]));
  });

  it("le pilote peut refuser ; une demande sans réponse expire", async () => {
    const { a, b } = await pair();
    await h.call(b.socket, "hand:request");
    await h.waitFor(() => a.states.at(-1)?.hand === "recue");
    expect(await h.call(a.socket, "hand:deny")).toEqual({ ok: true });
    await h.waitFor(() => b.states.at(-1)?.hand === "aucune");
    expect(a.states.at(-1)?.role).toBe("pilote");

    later(6000); // délai minimum entre deux demandes
    await h.call(b.socket, "hand:request");
    await h.waitFor(() => b.states.at(-1)?.hand === "envoyee");
    later(31_000);
    await h.hub.tick();
    await h.waitFor(() => b.states.at(-1)?.hand === "aucune");
  });

  it("le copilote prend la main si le pilote est absent depuis 20 s, pas avant", async () => {
    const { a, b } = await pair();
    a.socket.close();
    await h.waitFor(() => b.states.at(-1)?.partner?.online === false);
    expect(await h.call(b.socket, "hand:take")).toMatchObject({ ok: false, reason: "pilote-present" });
    later(21_000);
    await h.hub.tick();
    await h.waitFor(() => b.states.at(-1)?.canTakeOver === true);
    expect(await h.call(b.socket, "hand:take")).toEqual({ ok: true });
    const nb = await h.waitFor(() => b.states.at(-1)?.role === "pilote" && b.states.at(-1));
    expect(nb.code).toBeDefined();
  });
});

describe("reconnexion et persistance", () => {
  beforeEach(async () => (h = await setup()));

  it("un candidat qui se reconnecte retrouve le code et son rôle", async () => {
    const { a, sa } = await pair();
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "def corriger(x):\n    return 42\n" });
    a.socket.close();
    await h.waitFor(() => h.state.room?.code.includes("42"));
    const again = h.client(A);
    const s = await h.ready(again);
    expect(s.role).toBe("pilote");
    expect(s.code).toContain("return 42");
  });

  it("après un redémarrage du serveur, la salle est reconstruite depuis la base", async () => {
    const { a, sa } = await pair();
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "SAUVE" });
    a.socket.close();
    await h.waitFor(() => h.state.room?.code === "SAUVE");
    const room = h.state.room!;
    await h.close();
    h = await setup({ initialRoom: room });
    const s = await h.ready(h.client(A));
    expect(s.role).toBe("pilote");
    expect(s.code).toBe("SAUVE");
  });

  it("un deuxième onglet remplace le premier", async () => {
    const first = h.client(A);
    await h.ready(first);
    const replaced = new Promise((r) => first.socket.once("replaced", r));
    const second = h.client(A);
    await h.ready(second);
    await replaced;
    expect(h.state.journal.some((e) => e.type === "portail.presence" && e.payload?.replaced === true)).toBe(true);
  });

  it("enregistre des instantanés du code dans le journal (replay)", async () => {
    const { a, sa } = await pair();
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "SNAP" });
    later(6000);
    await h.hub.tick();
    const snap = h.state.journal.find((e) => e.type === "code.snapshot");
    expect(snap).toMatchObject({ sessionId: A, payload: { stage: "portail", code: "SNAP" } });
  });
});

describe("observateur recruteur", () => {
  beforeEach(async () => (h = await setup()));
  const observer = () => h.client(null, { auth: { observer: issueObserverToken(SLOT, h.state.now) } });

  it("voit tout, en direct, mais ne peut rien écrire", async () => {
    const { a, sa } = await pair();
    const o = observer();
    const so = await h.ready(o);
    expect(so.role).toBe("observateur");
    expect(so.code).toBe(BUGGY);
    expect(so.logs).toBeDefined();
    expect(so.players).toHaveLength(2);

    const live = new Promise<{ code: string }>((r) => o.socket.once("code", r));
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "EN-DIRECT" });
    expect((await live).code).toBe("EN-DIRECT");

    // Aucune écriture n'a de gestionnaire côté observateur : pas de réponse, aucun effet.
    for (const [event, payload] of [
      ["code:update", { epoch: sa.epoch, code: "OBS" }],
      ["run", {}],
      ["hand:grant", {}],
      ["hand:request", {}],
      ["hand:take", {}],
    ] as const) {
      expect(await h.call(o.socket, event, payload)).toEqual({ timeout: true });
    }
    expect(h.state.graded).toHaveLength(0);
    expect(h.state.journal.some((e) => e.actor === "recruteur" && e.type === "portail.observe")).toBe(true);
  });
});

describe("validation du debug", () => {
  beforeEach(async () => (h = await setup()));

  it("seul le pilote exécute ; le copilote voit les logs ; tous les tests passés = Portail résolu", async () => {
    const { a, b, sa } = await pair();
    expect(await h.call(b.socket, "run")).toMatchObject({ ok: false, reason: "lecture-seule" });

    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "MOITIE" });
    expect(await h.call(a.socket, "run")).toMatchObject({ ok: true, passed: 5, total: 9, solved: false });
    const sb = await h.waitFor(() => b.states.at(-1)?.logs?.some((l) => l.includes("5 / 9")) && b.states.at(-1));
    expect(sb.result).toMatchObject({ passed: 5, total: 9 });
    expect(JSON.stringify(a.states.at(-1))).not.toContain("exemple 1"); // le pilote ne voit pas les logs
    expect(a.states.at(-1)?.result).toMatchObject({ passed: 5, total: 9 });

    // 3 s minimum entre deux exécutions (contrôlé côté serveur)
    expect(await h.call(a.socket, "run")).toMatchObject({ ok: false, reason: "trop-tot" });
    later(3100);
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "FIXED" });
    expect(await h.call(a.socket, "run")).toMatchObject({ ok: true, passed: 9, total: 9, solved: true });
    await h.waitFor(() => b.states.at(-1)?.phase === "resolu");
    expect(h.state.room?.solvedAt).toBeTruthy();
    expect(h.state.journal.filter((e) => e.type === "portail.solved").map((e) => e.sessionId).sort()).toEqual([A, B]);
    // Plus d'écriture une fois résolu
    expect(await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "APRES" })).toMatchObject({ ok: false });
  });

  it("un code refusé avant exécution est signalé, sans panne du bac à sable", async () => {
    const { a, sa } = await pair();
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "x".repeat(2000) });
    expect(await h.call(a.socket, "run")).toMatchObject({ ok: false, reason: "invalide" });
  });
});

describe("ouverture et fin du temps", () => {
  it("le Portail reste fermé tant que les deux n'ont pas leurs 4 gemmes, et s'ouvre dès que c'est le cas", async () => {
    h = await setup({ gems: { a: ALL, b: ["quiz", "sql"] }, nowMin: 20 });
    const a = h.client(A);
    const s0 = await h.ready(a);
    expect(s0.phase).toBe("ferme");
    expect(s0.code).toBeUndefined();
    expect(s0.logs).toBeUndefined();
    // Écriture impossible tant que c'est fermé
    expect(await h.call(a.socket, "code:update", { epoch: s0.epoch, code: "TROP-TOT" })).toMatchObject({ ok: false, reason: "ferme" });

    h.state.members[1].gems = ALL;
    h.state.now = at(22);
    await h.hub.tick();
    const open = await h.waitFor(() => a.states.at(-1)?.phase === "ouvert" && a.states.at(-1));
    expect(open.role).toBe("pilote");
    expect(open.code).toBe(BUGGY);
    expect(h.state.journal.filter((e) => e.type === "portail.open")).toHaveLength(2);
  });

  it("à T0+33 le Portail s'ouvre même s'il manque des gemmes (journalisé pour le recruteur)", async () => {
    h = await setup({ gems: { a: ALL, b: ["quiz"] }, nowMin: 32 });
    const a = h.client(A);
    expect((await h.ready(a)).phase).toBe("ferme");
    h.state.now = at(33);
    await h.hub.tick();
    await h.waitFor(() => a.states.at(-1)?.phase === "ouvert");
    const ev = h.state.journal.find((e) => e.type === "portail.open");
    expect(ev?.payload).toMatchObject({ forced: true, missingGems: { [B]: ["sql", "algo", "logique"] } });
  });

  it("un candidat en retard rejoint en copilote ; un absent ne bloque pas l'ouverture à T0+33", async () => {
    h = await setup({ gems: { a: ALL, b: [] }, nowMin: 34 });
    const a = h.client(A);
    const s = await h.ready(a);
    expect(s.phase).toBe("ouvert");
    expect(s.role).toBe("pilote");
    expect(s.partner).toEqual({ name: "Bo", online: false });
    const b = h.client(B);
    expect((await h.ready(b)).role).toBe("copilote");
  });

  it("à T0+45 tout est coupé : état « terminé », écritures refusées, instantané final", async () => {
    h = await setup();
    const { a, b, sa } = await pair();
    await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "DERNIER" });
    h.state.now = at(45);
    await h.hub.tick();
    const end = await h.waitFor(() => a.states.at(-1)?.phase === "termine" && a.states.at(-1));
    expect(end.code).toBeUndefined();
    expect(b.states.at(-1)?.logs).toBeUndefined();
    expect(await h.call(a.socket, "code:update", { epoch: sa.epoch, code: "TARD" })).toMatchObject({ ok: false, reason: "ferme" });
    expect(await h.call(a.socket, "run")).toMatchObject({ ok: false, reason: "ferme" });
    expect(h.state.room?.code).toBe("DERNIER");
    expect(h.state.journal.filter((e) => e.type === "portail.end")).toHaveLength(2);
    expect(h.state.journal.some((e) => e.type === "code.snapshot" && e.payload?.code === "DERNIER")).toBe(true);
  });
});

describe("repli solo", () => {
  beforeEach(async () => (h = await setup({ gems: { a: ALL, b: [] }, nowMin: 20 })));

  it("le recruteur retire le partenaire absent : le candidat restant devient solo et voit tout", async () => {
    const a = h.client(A);
    expect((await h.ready(a)).phase).toBe("ferme"); // B n'a aucune gemme : fermé jusqu'à T0+33
    h.state.members[1].status = "expiree";
    h.state.now = at(21);
    await h.hub.tick();
    const solo = await h.waitFor(() => a.states.at(-1)?.phase === "ouvert" && a.states.at(-1));
    expect(solo.role).toBe("solo");
    expect(solo.code).toBeDefined();
    expect(solo.logs).toBeDefined();
    expect(solo.partner).toBeNull();
    // Le candidat retiré ne peut plus se connecter.
    expect(await h.refused(h.client(B))).toBe("refuse");
  });

  it("un partenaire retiré en cours de route est déconnecté ; le candidat restant garde le clavier", async () => {
    h.state.members[1].gems = ALL;
    const { a, b } = await pair();
    const gone = new Promise((r) => b.socket.once("retire", r));
    h.state.members[1].status = "expiree";
    later(4000);
    await h.hub.tick();
    await gone;
    const s = await h.waitFor(() => a.states.at(-1)?.role === "solo" && a.states.at(-1));
    expect(s.logs).toBeDefined();
  });
});
