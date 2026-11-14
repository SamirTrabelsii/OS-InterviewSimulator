import { describe, expect, it } from "vitest";
import { durationOf, stateAt, timeline, type ReplayEvent } from "./replay";

let seq = 0;
const ev = (t: number, type: string, payload: Record<string, unknown> = {}, actor: ReplayEvent["actor"] = "candidat"): ReplayEvent => ({
  seq: ++seq,
  t,
  actor,
  type,
  payload,
});

const SESSION: ReplayEvent[] = [
  ev(0, "session.start", {}, "systeme"),
  ev(1_000, "stage.enter", { stage: "hub" }),
  ev(5_000, "stage.leave", { stage: "hub" }),
  ev(5_100, "stage.enter", { stage: "sql" }),
  ev(10_000, "code.snapshot", { stage: "sql", code: "SELECT 1" }),
  ev(15_000, "code.run", { stage: "sql", query: "SELECT 1 FROM t", ok: true, rows: 3 }),
  ev(20_000, "focus.lost", { stage: "sql" }),
  ev(30_000, "focus.gained", { stage: "sql" }),
  ev(40_000, "sql.submit", { query: "SELECT a FROM t" }),
  ev(40_500, "sql.result", { passed: 1, total: 2 }, "systeme"),
  ev(60_000, "sql.submit", { query: "SELECT a, b FROM t" }),
  ev(60_400, "sql.result", { passed: 2, total: 2 }, "systeme"),
  ev(60_400, "gem.obtained", { gem: "sql" }, "systeme"),
  ev(65_000, "quiz.result", { correct: 7, total: 10, details: {} }, "systeme"),
  ev(70_000, "logique.attempt", { answer: "x", ok: false }),
  ev(80_000, "portail.open", { forced: false }, "systeme"),
  ev(80_001, "portail.role", { role: "pilote" }, "systeme"),
  ev(90_000, "portail.run", { code: "print(1)", epoch: 0 }),
  ev(90_500, "portail.result", { passed: 3, total: 5 }, "systeme"),
  ev(120_000, "session.end", { reason: "temps-ecoule" }, "systeme"),
];

describe("stateAt — reconstruction de l'état à l'instant t", () => {
  it("avant le premier événement : état vide", () => {
    const s = stateAt(SESSION, -1);
    expect(s.stage).toBeNull();
    expect(s.gems).toEqual([]);
    expect(s.code).toEqual({});
    expect(stateAt([], 5_000).stage).toBeNull();
  });

  it("suit l'écran courant (entrée/sortie)", () => {
    expect(stateAt(SESSION, 2_000).stage).toBe("hub");
    expect(stateAt(SESSION, 5_050).stage).toBeNull();
    expect(stateAt(SESSION, 6_000).stage).toBe("sql");
  });

  it("retient la dernière version du code à t, pas la suivante", () => {
    expect(stateAt(SESSION, 12_000).code.sql).toMatchObject({ code: "SELECT 1", source: "snapshot" });
    expect(stateAt(SESSION, 15_000).code.sql).toMatchObject({ code: "SELECT 1 FROM t", source: "run" });
    expect(stateAt(SESSION, 45_000).code.sql).toMatchObject({ code: "SELECT a FROM t", source: "submit" });
    expect(stateAt(SESSION, 100_000).code.portail?.code).toBe("print(1)");
  });

  it("l'instant t est inclus", () => {
    expect(stateAt(SESSION, 40_000).counts.sql.submits).toBe(1);
    expect(stateAt(SESSION, 39_999).counts.sql.submits).toBe(0);
  });

  it("résultats, essais et gemmes à t", () => {
    const mid = stateAt(SESSION, 50_000);
    expect(mid.results.sql).toMatchObject({ passed: 1, total: 2 });
    expect(mid.gems).toEqual([]);
    const end = stateAt(SESSION, 61_000);
    expect(end.results.sql).toMatchObject({ passed: 2, total: 2 });
    expect(end.gems).toEqual([{ gem: "sql", t: 60_400 }]);
    expect(end.counts.sql).toEqual({ submits: 2, runs: 1 });
    expect(end.counts.logique).toBeUndefined();
    expect(stateAt(SESSION, 75_000).counts.logique.submits).toBe(1);
    expect(stateAt(SESSION, 64_000).results.quiz).toBeUndefined();
    expect(stateAt(SESSION, 75_000).results.quiz).toMatchObject({ passed: 7, total: 10 });
  });

  it("focus perdu puis retrouvé", () => {
    expect(stateAt(SESSION, 25_000)).toMatchObject({ focusLost: true, focusLostCount: 1 });
    expect(stateAt(SESSION, 35_000)).toMatchObject({ focusLost: false, focusLostCount: 1 });
  });

  it("Portail : ouverture, rôle, résultat, fin", () => {
    const s = stateAt(SESSION, 100_000);
    expect(s.portail).toMatchObject({ open: true, role: "pilote", solved: false });
    expect(s.results.portail).toMatchObject({ passed: 3, total: 5 });
    expect(stateAt(SESSION, 79_000).portail.open).toBe(false);
    expect(stateAt(SESSION, 120_000).ended).toBe(true);
  });

  it("ne dépend pas de l'ordre de la liste, et ne la modifie pas", () => {
    const shuffled = [...SESSION].reverse();
    const before = JSON.stringify(shuffled);
    expect(stateAt(shuffled, 61_000)).toEqual(stateAt(SESSION, 61_000));
    expect(JSON.stringify(shuffled)).toBe(before);
  });

  it("ignore les charges utiles inattendues sans planter", () => {
    const weird = [ev(1, "code.snapshot", { stage: 3, code: 4 }), ev(2, "sql.result", { passed: "x" }), ev(3, "gem.obtained", {})];
    expect(() => stateAt(weird, 10)).not.toThrow();
    expect(stateAt(weird, 10).gems).toEqual([]);
  });
});

describe("timeline et durée", () => {
  it("produit les repères utiles dans l'ordre", () => {
    const labels = timeline(SESSION).map((m) => m.label);
    expect(labels[0]).toBe("Début de la session");
    expect(labels).toContain("Gemme obtenue : SQL");
    expect(labels).toContain("Onglet quitté");
    expect(labels).toContain("Ouverture du Portail");
    expect(labels).toContain("Résultat du Portail");
  });
  it("durationOf", () => {
    expect(durationOf(SESSION)).toBe(120_000);
    expect(durationOf([])).toBe(1000);
  });
});
