// Validateur de la gemme SQL : vrai contenu, vrai bac à sable (sql.js dans
// un processus enfant), vraie requête solution.
import { afterAll, describe, expect, it, vi } from "vitest";
import { buildInstance } from "@/engine/content/instance";
import { MalformedAnswerError } from "@/engine/validators/errors";
import { scenarios } from "@content/index";
import { SandboxPool } from "@/server/sandbox/pool";
import { runReferenceSql } from "./reference-sql";
import { datasetToSql } from "@/engine/sql/setup";
import { gradeSql } from "./sql";

vi.setConfig({ testTimeout: 120_000 });

const pool = new SandboxPool({ maxConcurrent: 2, warm: 1 });
pool.prewarm();
afterAll(() => pool.close());
const run = pool.run.bind(pool);

/** Requête solution sans le commentaire canari, pour écrire des variantes. */
const strip = (sql: string) => sql.replace(/^--.*\n/, "").trim().replace(/;$/, "");

describe.each(scenarios.map((s) => [s.meta.id, s] as const))("validateur SQL — %s", (_id, def) => {
  const stage = buildInstance(def, 4242n).stages.sql;
  const solution = strip(stage.private.solutionSql);

  it("requête juste → 2 / 2 (jeu visible et jeu caché)", async () => {
    const g = await gradeSql(stage, solution, run);
    expect(g).toMatchObject({ passed: 2, total: 2, status: "ok" });
    expect(g.error).toBeUndefined();
  });

  it("résultat juste mais dans le désordre : refusé si l'énoncé impose l'ordre, accepté sinon", async () => {
    expect(stage.private.orderMatters).toBe(true);
    const reversed = `SELECT * FROM (${solution}) ORDER BY valeur_ecart ASC, boutique_id DESC`;
    const g = await gradeSql(stage, reversed, run);
    expect(g.passed).toBe(0);
    expect(g.checks.map((c) => c.reason)).toEqual(["ordre", "ordre"]);

    const unordered = { ...stage, private: { ...stage.private, orderMatters: false } };
    expect(await gradeSql(unordered, reversed, run)).toMatchObject({ passed: 2, total: 2 });
  });

  it("requête codée en dur sur le jeu visible → échoue sur le jeu caché (1 / 2)", async () => {
    const visible = await runReferenceSql(datasetToSql(stage.public.dataset), stage.private.solutionSql);
    const literal = (v: unknown) => (typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : String(v));
    const hardcoded = visible.rows
      .map((row, i) => `SELECT ${row.map((v, j) => `${literal(v)}${i === 0 ? ` AS ${visible.columns[j]}` : ""}`).join(", ")}`)
      .join(" UNION ALL ");
    const g = await gradeSql(stage, hardcoded, run);
    expect(g).toMatchObject({ passed: 1, total: 2 });
    expect(g.checks).toEqual([
      { dataset: "visible", ok: true },
      { dataset: "cache", ok: false, reason: "valeurs" },
    ]);
  });

  it("CTE récursive infinie → coupée par le délai, 0 / 2, message générique", async () => {
    const g = await gradeSql(stage, "WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM r) SELECT count(*) FROM r", run);
    expect(g).toMatchObject({ passed: 0, total: 2, status: "timeout", error: "Temps d'exécution dépassé" });
    expect(g.durationMs).toBeLessThan(5_000);
  });

  it("erreur de syntaxe → 0 / 2 avec le message de SQLite", async () => {
    const g = await gradeSql(stage, "SELEC boutique_id FROM boutiques", run);
    expect(g).toMatchObject({ passed: 0, status: "error" });
    expect(g.error).toMatch(/syntax error/);
  });

  it("refuse une requête mal formée sans lancer d'exécution", async () => {
    await expect(gradeSql(stage, "   ", run)).rejects.toThrow(MalformedAnswerError);
    await expect(gradeSql(stage, { query: solution }, run)).rejects.toThrow(MalformedAnswerError);
  });
});
