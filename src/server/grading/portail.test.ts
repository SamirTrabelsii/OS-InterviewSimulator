// Validateur du Portail : vrai contenu, vrai bac à sable (Pyodide).
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildInstance } from "@/engine/content/instance";
import { scenarios } from "@content/index";
import { SandboxPool } from "@/server/sandbox/pool";
import { gradePortail } from "./portail";

vi.setConfig({ testTimeout: 120_000 });

const pool = new SandboxPool({ maxConcurrent: 2, warm: 1 });
pool.prewarm();
afterAll(() => pool.close());
const run = pool.run.bind(pool);

describe.each(scenarios.map((s) => [s.meta.id, s] as const))("validateur Portail — %s", (_id, def) => {
  const stage = buildInstance(def, 4242n).stages.portail;
  const total = stage.private.hiddenTests.length;

  it("solution corrigée → Y / Y", async () => {
    const g = await gradePortail(stage, stage.private.fixedSolution, run);
    expect(g).toMatchObject({ passed: total, total });
    expect(g.publicError).toBeUndefined();
  });

  it("code cassé d'origine → X / Y avec X < Y, et des logs sur les exemples publics seulement", async () => {
    const g = await gradePortail(stage, stage.public.buggyCode, run);
    expect(g.passed).toBeLessThan(total);
    const logs = g.logLines.join("\n");
    expect(logs).toContain(`vérifications : ${g.passed} / ${total}`);
    expect(logs).toContain("exemple 1");
    // Aucun attendu d'un test caché dans les logs du copilote.
    for (const t of stage.private.hiddenTests) {
      const exp = JSON.stringify(t.expected);
      if (exp.length > 20 && !stage.public.examples.some((e) => JSON.stringify(e.expected) === exp)) expect(logs).not.toContain(exp);
    }
    expect(logs).not.toContain(stage.private.canary);
  });

  it("erreur de syntaxe → message public, 0 / Y", async () => {
    const g = await gradePortail(stage, "def commandes_reassort(:\n  pass", run);
    expect(g.passed).toBe(0);
    expect(g.publicError).toBeTruthy();
    expect(g.logLines.join("\n")).toContain("ERROR");
  });
});
