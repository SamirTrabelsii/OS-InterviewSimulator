// Gemme SQL : règles de comparaison, pures (sans bac à sable ni base).
// L'exécution est dans src/server/grading/sql.ts.
import { MalformedAnswerError } from "./errors";

/** Délai minimal entre deux soumissions SQL ou Algo (appliqué côté serveur). */
export const CODE_SUBMIT_COOLDOWN_MS = 3_000;

export const MAX_SQL_QUERY_CHARS = 10_000;

/** Lignes renvoyées par le bac à sable : au-delà, le résultat est forcément faux. */
export const SQL_MAX_ROWS = 2_000;

export type SqlTable = { columns: string[]; rows: unknown[][]; truncated?: boolean };

export function normalizeSqlQuery(raw: unknown): string {
  if (typeof raw !== "string") throw new MalformedAnswerError("Requête illisible.");
  const query = raw.trim();
  if (!query) throw new MalformedAnswerError("Écrivez une requête avant de soumettre.");
  if (query.length > MAX_SQL_QUERY_CHARS) throw new MalformedAnswerError("Requête trop longue.");
  return query;
}

/** Raisons d'un écart, pour le replay recruteur uniquement. */
export type SqlMismatch = "colonnes" | "lignes" | "valeurs" | "ordre" | "tronque";

/** Deux nombres sont égaux à 1e-6 près (ROUND et divisions en flottant). */
function sameCell(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  return a === b;
}

const sameRow = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v, i) => sameCell(v, b[i]));

/** Clé de tri stable pour comparer sans tenir compte de l'ordre (nombres arrondis). */
const rowKey = (row: unknown[]) =>
  JSON.stringify(row.map((v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)));

/**
 * Compare le résultat du candidat au résultat de la requête solution.
 *   - colonnes : mêmes noms (casse ignorée), dans l'ordre de l'énoncé ;
 *   - lignes : même nombre, mêmes valeurs ; l'ordre ne compte que si
 *     l'énoncé l'impose (`orderMatters`).
 */
export function compareSqlResults(
  expected: SqlTable,
  actual: SqlTable,
  orderMatters: boolean,
): { ok: true } | { ok: false; reason: SqlMismatch } {
  if (actual.truncated) return { ok: false, reason: "tronque" };
  const norm = (cols: string[]) => cols.map((c) => c.trim().toLowerCase());
  if (JSON.stringify(norm(expected.columns)) !== JSON.stringify(norm(actual.columns))) return { ok: false, reason: "colonnes" };
  if (expected.rows.length !== actual.rows.length) return { ok: false, reason: "lignes" };

  if (expected.rows.every((row, i) => sameRow(row, actual.rows[i]))) return { ok: true };

  const sorted = (rows: unknown[][]) => rows.map((r) => [rowKey(r), r] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const e = sorted(expected.rows);
  const a = sorted(actual.rows);
  const sameSet = e.every(([, row], i) => sameRow(row, a[i][1]));
  if (!sameSet) return { ok: false, reason: "valeurs" };
  return orderMatters ? { ok: false, reason: "ordre" } : { ok: true };
}
