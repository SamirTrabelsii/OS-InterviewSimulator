import { describe, expect, it } from "vitest";
import { allCanaries, listScenarios, loadInstance, loadPublicInstance } from "./registry";

describe("registre de contenu", () => {
  it("liste le scénario retail", () => {
    expect(listScenarios().map((m) => m.id)).toContain("retail");
  });

  it("refuse un scénario inconnu", () => {
    expect(() => loadInstance("inconnu", 1n)).toThrow(/inconnu/);
  });

  it("met en cache une instance gelée, non modifiable", () => {
    const a = loadInstance("retail", 77n);
    expect(loadInstance("retail", 77n)).toBe(a);
    expect(Object.isFrozen(a.stages.sql.private)).toBe(true);
    expect(() => {
      (a.stages.logique.private as { answer: string }).answer = "0000";
    }).toThrow();
  });

  it("la version publique ne contient aucun canari", () => {
    const json = JSON.stringify(loadPublicInstance("retail", 77n));
    for (const c of allCanaries()) expect(json).not.toContain(c);
  });
});
