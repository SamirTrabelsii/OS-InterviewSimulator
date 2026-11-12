import "server-only";
import type { ScenarioInstance } from "@/engine/content/schemas";
import { datasetToSql } from "@/engine/sql/setup";
import { compareSqlResults, normalizeSqlQuery, SQL_MAX_ROWS, type SqlMismatch, type SqlTable } from "@/engine/validators/sql";
import type { SandboxJob, SandboxResult, SandboxStatus } from "@/server/sandbox/protocol";
import { runReferenceSql } from "./reference-sql";

type SqlStage = ScenarioInstance["stages"]["sql"];

/** Exécution dans le bac à sable (SandboxPool.run en production, simulable en test). */
export type RunJob = (job: SandboxJob) => Promise<SandboxResult>;

/** Le bac à sable n'a pas pu exécuter la requête : ce n'est pas la faute du candidat. */
export class SandboxUnavailableError extends Error {
  constructor(readonly status: SandboxStatus) {
    super(`Bac à sable indisponible (${status})`);
  }
}

export type SqlGrade = {
  /** Vérifications réussies sur `total` (jeu visible, jeu caché). */
  passed: number;
  total: number;
  /** Pour le replay recruteur uniquement. */
  status: SandboxStatus;
  checks: { dataset: "visible" | "cache"; ok: boolean; reason?: SqlMismatch }[];
  /** Erreur de la requête du candidat (syntaxe, délai…) : montrable au candidat. */
  error?: string;
  durationMs: number;
};

type Prepared = { setups: [string, string]; expected: [SqlTable, SqlTable] };
const prepared = new WeakMap<SqlStage, Promise<Prepared>>();

/** Bases et résultats attendus, calculés une fois par instance (gelée, en cache). */
function prepare(stage: SqlStage): Promise<Prepared> {
  let p = prepared.get(stage);
  if (!p) {
    p = (async () => {
      const setups: [string, string] = [datasetToSql(stage.public.dataset), datasetToSql(stage.private.hiddenDataset)];
      const expected: [SqlTable, SqlTable] = [
        await runReferenceSql(setups[0], stage.private.solutionSql),
        await runReferenceSql(setups[1], stage.private.solutionSql),
      ];
      return { setups, expected };
    })();
    prepared.set(stage, p);
  }
  return p;
}

/**
 * Corrige une requête : elle est exécutée dans le bac à sable sur le jeu
 * visible ET sur le jeu caché (anti codage en dur), puis comparée au
 * résultat de la requête solution sur chacun.
 */
export async function gradeSql(stage: SqlStage, rawQuery: unknown, run: RunJob): Promise<SqlGrade> {
  const query = normalizeSqlQuery(rawQuery); // lève MalformedAnswerError
  const { setups, expected } = await prepare(stage);
  const r = await run({ kind: "sql", setup: setups[0], extraSetups: [setups[1]], query, maxRows: SQL_MAX_ROWS });

  if (r.status === "busy" || r.status === "crash") throw new SandboxUnavailableError(r.status);
  const base = { total: 2, status: r.status, durationMs: r.durationMs };
  if (r.status !== "ok" || !r.sqlRuns || r.sqlRuns.length !== 2) {
    return {
      ...base,
      passed: 0,
      checks: [
        { dataset: "visible", ok: false },
        { dataset: "cache", ok: false },
      ],
      error: r.error ?? "Exécution impossible",
    };
  }

  const checks = (["visible", "cache"] as const).map((dataset, i) => {
    const c = compareSqlResults(expected[i], r.sqlRuns![i], stage.private.orderMatters);
    return c.ok ? { dataset, ok: true } : { dataset, ok: false, reason: c.reason };
  });
  return { ...base, passed: checks.filter((c) => c.ok).length, checks };
}
