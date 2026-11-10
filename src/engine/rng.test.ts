import { describe, expect, it } from "vitest";
import { Rng } from "./rng";

const draw = (rng: Rng, n = 20) => Array.from({ length: n }, () => rng.next());

describe("Rng", () => {
  it("même graine et même flux → même suite", () => {
    expect(draw(new Rng(42n, "sql"))).toEqual(draw(new Rng(42n, "sql")));
  });

  it("bigint, nombre et chaîne de même valeur sont équivalents", () => {
    expect(draw(new Rng(42n))).toEqual(draw(new Rng(42)));
    expect(draw(new Rng(42n))).toEqual(draw(new Rng("42")));
  });

  it("graines ou flux différents → suites différentes", () => {
    expect(draw(new Rng(42n))).not.toEqual(draw(new Rng(43n)));
    expect(draw(new Rng(42n, "sql"))).not.toEqual(draw(new Rng(42n, "algo")));
  });

  it("fork() ne consomme pas le flux parent", () => {
    const a = new Rng(7n);
    const b = new Rng(7n);
    a.fork("enfant").next();
    expect(a.next()).toBe(b.next());
  });

  it("valeur figée : protège contre un changement involontaire d'algorithme", () => {
    // Si ce test casse, toutes les sessions existantes changeraient de données.
    expect(new Rng(1n).int(0, 1_000_000)).toMatchInlineSnapshot(`243177`);
  });

  it("int() respecte ses bornes et couvre tout l'intervalle", () => {
    const rng = new Rng(3n);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("shuffle() et sample() conservent les éléments", () => {
    const rng = new Rng(5n);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(rng.shuffle(items).sort()).toEqual(items);
    const s = rng.sample(items, 3);
    expect(new Set(s).size).toBe(3);
    expect(() => rng.sample(items, 9)).toThrow();
  });
});
