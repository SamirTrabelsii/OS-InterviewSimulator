// Validateur de la gemme Algo : vrai contenu, vrai bac à sable (Pyodide).
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildInstance } from "@/engine/content/instance";
import { MalformedAnswerError } from "@/engine/validators/errors";
import { jsonEqual } from "@/engine/validators/algo";
import { scenarios } from "@content/index";
import { SandboxPool } from "@/server/sandbox/pool";
import { gradeAlgo, type AlgoGrade } from "./algo";

vi.setConfig({ testTimeout: 120_000 });

const pool = new SandboxPool({ maxConcurrent: 2, warm: 1 });
pool.prewarm();
afterAll(() => pool.close());
const run = pool.run.bind(pool);

/** Ce que la route renvoie au candidat (voir submitCode). */
const candidateView = (g: AlgoGrade) => ({ passed: g.passed, total: g.total, ...(g.publicError ? { error: g.publicError } : {}) });

describe("égalité JSON", () => {
  it("ignore l'ordre des clés, pas celui des listes", () => {
    expect(jsonEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonEqual({ a: 1 }, { a: "1" })).toBe(false);
    expect(jsonEqual(null, {})).toBe(false);
  });
});

describe.each(scenarios.map((s) => [s.meta.id, s] as const))("validateur Algo — %s", (_id, def) => {
  const stage = buildInstance(def, 4242n).stages.algo;
  const total = stage.private.hiddenTests.length;
  const fn = stage.public.signature.functionName;
  const params = stage.public.signature.params.join(", ");

  it("solution de référence → Y / Y", async () => {
    const g = await gradeAlgo(stage, stage.private.referenceSolution, run);
    expect(g).toMatchObject({ passed: total, total, status: "ok" });
    expect(g.publicError).toBeUndefined();
  });

  it("solution fausse → X / Y avec X < Y, sans message d'erreur", async () => {
    // Retail : compte tous les scans, sans éliminer les doubles bips.
    const wrong = `def ${fn}(${params}):\n    out = {}\n    for _, sku in scans:\n        out[sku] = out.get(sku, 0) + 1\n    return out\n`;
    const g = await gradeAlgo(stage, wrong, run);
    expect(g.status).toBe("ok");
    expect(g.passed).toBeGreaterThan(0);
    expect(g.passed).toBeLessThan(total);
    expect(candidateView(g)).toEqual({ passed: g.passed, total });
  });

  it("solution juste mais trop lente → délai dépassé, gemme impossible", async () => {
    // Même résultat que la référence, en recomptant tout l'historique à chaque scan (cubique).
    const slow =
      stage.private.referenceSolution.replace(/^#.*\n/, "") +
      `\n_ref = ${fn}\ndef ${fn}(${params}):\n    for i in range(len(scans)):\n        for j in range(i):\n            _ref(scans[:j], k)\n    return _ref(scans, k)\n`;
    const g = await gradeAlgo(stage, slow, run);
    expect(g.status).toBe("timeout");
    expect(g.passed).toBeLessThan(total);
    expect(candidateView(g)).toEqual({ passed: g.passed, total, error: "Temps d'exécution dépassé" });
  });

  it("tenter d'afficher les tests cachés : rien ne fuit dans la réponse", async () => {
    const spy = `
import json, sys
def ${fn}(*args):
    print("FUITE", json.dumps(args))
    sys.stderr.write(json.dumps(args))
    raise ValueError("FUITE " + json.dumps(args))
`;
    const g = await gradeAlgo(stage, spy, run);
    expect(g.passed).toBe(0);
    const response = JSON.stringify(candidateView(g));
    expect(response).toBe(JSON.stringify({ passed: 0, total }));
    for (const t of stage.private.hiddenTests) {
      for (const leaf of JSON.stringify(t.args).match(/"[^"]+"/g) ?? []) expect(response).not.toContain(leaf);
    }
    // Le détail (recruteur) garde l'erreur de chaque test.
    expect(g.cases[0].error).toMatch(/ValueError: FUITE/);
  });

  it("code qui ne compile pas → 0 / Y avec l'erreur de syntaxe", async () => {
    const g = await gradeAlgo(stage, `def ${fn}(${params})\n    return {}\n`, run);
    expect(candidateView(g)).toMatchObject({ passed: 0, total, error: expect.stringMatching(/SyntaxError/) });
  });

  it("refuse un code mal formé sans lancer d'exécution", async () => {
    await expect(gradeAlgo(stage, "  \n", run)).rejects.toThrow(MalformedAnswerError);
    await expect(gradeAlgo(stage, 42, run)).rejects.toThrow(MalformedAnswerError);
  });
});
