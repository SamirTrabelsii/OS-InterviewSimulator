import { describe, expect, it } from "vitest";
import {
  applyCode,
  buildView,
  CHAT_MAX_LEN,
  claimDriver,
  denyHand,
  DRIVER_ABSENT_TAKEOVER_MS,
  expireRequest,
  grantHand,
  normalizeChat,
  HAND_REQUEST_COOLDOWN_MS,
  HAND_REQUEST_TTL_MS,
  portalPhase,
  reconcileActive,
  requestHand,
  roleOf,
  takeOver,
  type PortalStage,
  type RoomCore,
} from "./portal";

const A = "a";
const B = "b";
const both = [A, B];
const fresh = (): RoomCore => ({ code: "def f(): pass", epoch: 1, driverId: A, request: null, solved: false });

const stage: PortalStage = {
  title: "Le Portail",
  story: "Histoire",
  statement: "ENONCE-DU-TICKET",
  signature: { functionName: "f", params: [] },
  buggyCode: "def f(): pass",
  examples: [{ args: [], expected: 1 }],
  logs: ["06:00:01 INFO LOG-INITIAL"],
  clientContext: "CONTEXTE-CLIENT",
};

describe("rôles", () => {
  it("un pilote, un copilote ; un seul candidat actif = solo ; inconnu = aucun rôle", () => {
    const room = fresh();
    expect(roleOf(room, A, both)).toBe("pilote");
    expect(roleOf(room, B, both)).toBe("copilote");
    expect(roleOf(room, A, [A])).toBe("solo");
    expect(roleOf(room, "intrus", both)).toBeNull();
  });

  it("le premier arrivé prend le clavier, pas le suivant", () => {
    const empty: RoomCore = { ...fresh(), driverId: null, epoch: 0 };
    const first = claimDriver(empty, B, both);
    expect(first.driverId).toBe(B);
    expect(claimDriver(first, A, both)).toBe(first);
  });
});

describe("écriture : un seul au clavier", () => {
  it("le pilote écrit, le copilote non", () => {
    const room = fresh();
    expect(applyCode(room, A, 1, "x = 1", both)).toMatchObject({ ok: true, room: { code: "x = 1" } });
    expect(applyCode(room, B, 1, "x = 1", both)).toEqual({ ok: false, reason: "lecture-seule" });
  });
  it("refuse une époque périmée (ancien pilote après un passage de main)", () => {
    expect(applyCode(fresh(), A, 0, "x", both)).toEqual({ ok: false, reason: "epoque" });
  });
  it("refuse un code trop long et une salle résolue", () => {
    expect(applyCode(fresh(), A, 1, "x".repeat(60_000), both)).toEqual({ ok: false, reason: "trop-long" });
    expect(applyCode({ ...fresh(), solved: true }, A, 1, "x", both)).toEqual({ ok: false, reason: "resolu" });
  });
});

describe("passage de main", () => {
  it("demande → accord : les rôles s'échangent et l'époque change", () => {
    const asked = requestHand(fresh(), B, both, 1000, null);
    expect(asked.ok).toBe(true);
    if (!asked.ok) return;
    const granted = grantHand(asked.room, A, both);
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;
    expect(granted.room).toMatchObject({ driverId: B, epoch: 2, request: null });
    expect(roleOf(granted.room, A, both)).toBe("copilote");
    // l'ancien pilote n'écrit plus, même avec l'ancienne époque
    expect(applyCode(granted.room, A, 1, "x", both).ok).toBe(false);
    expect(applyCode(granted.room, B, 2, "x", both).ok).toBe(true);
  });

  it("seul le copilote demande ; une seule demande ; espacées de 5 s", () => {
    expect(requestHand(fresh(), A, both, 0, null)).toEqual({ ok: false, reason: "pas-copilote" });
    const asked = requestHand(fresh(), B, both, 0, null);
    if (!asked.ok) throw new Error("attendu");
    expect(requestHand(asked.room, B, both, 1, null)).toEqual({ ok: false, reason: "deja-demandee" });
    expect(requestHand(fresh(), B, both, 1000, 1000 - HAND_REQUEST_COOLDOWN_MS + 1)).toEqual({ ok: false, reason: "trop-tot" });
  });

  it("seul le pilote accorde ou refuse", () => {
    const asked = requestHand(fresh(), B, both, 0, null);
    if (!asked.ok) throw new Error("attendu");
    expect(grantHand(asked.room, B, both)).toEqual({ ok: false, reason: "pas-pilote" });
    expect(denyHand(asked.room, B, both)).toEqual({ ok: false, reason: "pas-pilote" });
    const denied = denyHand(asked.room, A, both);
    expect(denied).toMatchObject({ ok: true, room: { request: null, driverId: A, epoch: 1 } });
    expect(grantHand(fresh(), A, both)).toEqual({ ok: false, reason: "aucune-demande" });
  });

  it("une demande sans réponse expire après 30 s", () => {
    const asked = requestHand(fresh(), B, both, 0, null);
    if (!asked.ok) throw new Error("attendu");
    expect(expireRequest(asked.room, HAND_REQUEST_TTL_MS - 1).request).not.toBeNull();
    expect(expireRequest(asked.room, HAND_REQUEST_TTL_MS).request).toBeNull();
  });

  it("prise de main sans accord seulement si le pilote est absent depuis 20 s", () => {
    const now = 100_000;
    expect(takeOver(fresh(), B, both, null, now)).toEqual({ ok: false, reason: "pilote-present" });
    expect(takeOver(fresh(), B, both, now - DRIVER_ABSENT_TAKEOVER_MS + 1, now)).toEqual({ ok: false, reason: "pilote-present" });
    expect(takeOver(fresh(), B, both, now - DRIVER_ABSENT_TAKEOVER_MS, now)).toMatchObject({ ok: true, room: { driverId: B, epoch: 2 } });
    expect(takeOver(fresh(), A, both, 0, now)).toEqual({ ok: false, reason: "pas-copilote" });
  });
});

describe("repli solo", () => {
  it("si le pilote est retiré, le candidat restant prend le clavier", () => {
    const next = reconcileActive(fresh(), [B]);
    expect(next).toMatchObject({ driverId: B, epoch: 2 });
    expect(roleOf(next, B, [B])).toBe("solo");
  });
  it("si le pilote reste, rien ne change (sauf une demande du candidat retiré)", () => {
    const asked = requestHand(fresh(), B, both, 0, null);
    if (!asked.ok) throw new Error("attendu");
    const next = reconcileActive(asked.room, [A]);
    expect(next).toMatchObject({ driverId: A, epoch: 1, request: null });
  });
});

describe("phase", () => {
  const t0 = new Date("2026-12-01T09:00:00Z");
  const deadline = new Date(t0.getTime() + 45 * 60_000);
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  it("fermé tant que non ouvert, ouvert, résolu, puis terminé à T0+45", () => {
    const base = { t0, deadline, opened: false, solved: false };
    expect(portalPhase({ ...base, now: at(10) })).toBe("ferme");
    expect(portalPhase({ ...base, opened: true, now: at(10) })).toBe("ouvert");
    expect(portalPhase({ ...base, opened: true, solved: true, now: at(20) })).toBe("resolu");
    expect(portalPhase({ ...base, opened: true, now: at(45) })).toBe("termine");
    expect(portalPhase({ ...base, opened: true, solved: true, now: at(46) })).toBe("termine");
    expect(portalPhase({ ...base, t0: null, deadline: null, now: at(1) })).toBe("ferme");
  });
});

describe("vues asymétriques", () => {
  const now = new Date("2026-12-01T09:20:00Z");
  const players = [
    { id: A, name: "Ana", online: true },
    { id: B, name: "Bo", online: false },
  ];
  const view = (role: "pilote" | "copilote" | "solo" | "observateur", viewer: string | null, room = fresh()) =>
    buildView({
      role,
      viewer,
      room,
      stage,
      runLogs: ["06:20:00 RUN-DU-PILOTE"],
      result: { passed: 3, total: 9, at: now.toISOString() },
      phase: "ouvert",
      now,
      deadline: new Date(now.getTime() + 600_000),
      opensByLatest: now,
      players,
      canTakeOver: true,
    });

  it("le pilote voit le code, jamais les logs ni le contexte client", () => {
    const v = view("pilote", A);
    expect(v.code).toBe("def f(): pass");
    const json = JSON.stringify(v);
    for (const secret of ["CONTEXTE-CLIENT", "LOG-INITIAL", "RUN-DU-PILOTE", "ENONCE-DU-TICKET"]) expect(json).not.toContain(secret);
    expect(v.logs).toBeUndefined();
    expect(v.partner).toEqual({ name: "Bo", online: false, gems: 0 });
  });

  it("le copilote voit logs, contexte, énoncé et exemples, jamais le code", () => {
    const v = view("copilote", B);
    expect(v.logs).toEqual(["06:00:01 INFO LOG-INITIAL", "06:20:00 RUN-DU-PILOTE"]);
    expect(v.clientContext).toBe("CONTEXTE-CLIENT");
    expect(v.statement).toBe("ENONCE-DU-TICKET");
    expect(v.code).toBeUndefined();
    expect(v.functionName).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain("def f()");
    expect(v.canTakeOver).toBe(true);
  });

  it("après un passage de main, les vues s'échangent", () => {
    const asked = requestHand(fresh(), B, both, 0, null);
    if (!asked.ok) throw new Error("attendu");
    const granted = grantHand(asked.room, A, both);
    if (!granted.ok) throw new Error("attendu");
    expect(view("pilote", B, granted.room).code).toBeDefined();
    expect(view("copilote", A, granted.room).code).toBeUndefined();
    expect(view("copilote", A, granted.room).logs).toBeDefined();
  });

  it("indique la demande à chacun", () => {
    const asked = requestHand(fresh(), B, both, 0, null);
    if (!asked.ok) throw new Error("attendu");
    expect(view("pilote", A, asked.room).hand).toBe("recue");
    expect(view("copilote", B, asked.room).hand).toBe("envoyee");
  });

  it("solo et observateur voient tout ; l'observateur voit les joueurs", () => {
    for (const v of [view("solo", A), view("observateur", null)]) {
      expect(v.code).toBeDefined();
      expect(v.logs).toBeDefined();
    }
    expect(view("observateur", null).players).toHaveLength(2);
    expect(view("pilote", A).players).toBeUndefined();
  });

  it("Portail fermé : ni code, ni logs, ni contexte, pour personne", () => {
    const v = buildView({ ...{ role: "pilote" as const, viewer: A, room: fresh(), stage, runLogs: [], result: null, now, deadline: now, opensByLatest: now, players, canTakeOver: false }, phase: "ferme" });
    expect(v.code).toBeUndefined();
    expect(v.logs).toBeUndefined();
    expect(v.clientContext).toBeUndefined();
  });
});

describe("chat de secours", () => {
  it("nettoie et borne les messages", () => {
    expect(normalizeChat("  a \n  b  ")).toBe("a b");
    expect(normalizeChat("   ")).toBeNull();
    expect(normalizeChat(12)).toBeNull();
    expect(normalizeChat("x".repeat(CHAT_MAX_LEN + 50))).toHaveLength(CHAT_MAX_LEN);
  });

  it("la vue contient le chat (avec « mine »), le lien de l'appel et les gemmes du binôme ; rien en solo", () => {
    const now = new Date("2026-12-01T09:20:00Z");
    const players = [
      { id: A, name: "Ana", online: true, gems: 4 },
      { id: B, name: "Bo", online: true, gems: 2 },
    ];
    const base = {
      viewer: A,
      room: { code: "x", epoch: 1, driverId: A, request: null, solved: false },
      stage: { title: "t", story: "s", statement: "", signature: { functionName: "f", params: [] }, buggyCode: "", examples: [], logs: [], clientContext: "" } as PortalStage,
      runLogs: [],
      result: null,
      phase: "ferme" as const,
      now,
      deadline: now,
      opensByLatest: now,
      players,
      canTakeOver: false,
      callUrl: "https://teams.example/appel",
      chat: [
        { id: 1, from: A, name: "Ana", text: "salut", at: now.toISOString() },
        { id: 2, from: B, name: "Bo", text: "coucou", at: now.toISOString() },
      ],
    };
    const v = buildView({ ...base, role: "pilote" });
    expect(v.callUrl).toBe("https://teams.example/appel");
    expect(v.partner).toEqual({ name: "Bo", online: true, gems: 2 });
    expect(v.chat?.map((m) => m.mine)).toEqual([true, false]);
    expect(buildView({ ...base, role: "solo", players: [players[0]] }).chat).toBeNull();
  });
});
