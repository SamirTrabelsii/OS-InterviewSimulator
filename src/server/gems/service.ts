import { and, desc, eq, sql } from "drizzle-orm";
import type { GemId } from "@/engine/timeline";
import { checkLogique, LOGIQUE_COOLDOWN_MS } from "@/engine/validators/logique";
import { gradeQuiz } from "@/engine/validators/quiz";
import { CODE_SUBMIT_COOLDOWN_MS, normalizeSqlQuery } from "@/engine/validators/sql";
import { normalizePythonCode } from "@/engine/validators/algo";
import { gradeAlgo } from "@/server/grading/algo";
import { gradeSql, type RunJob } from "@/server/grading/sql";
import { appendEvents } from "@/server/candidate/events";
import { assertCanSubmit, type CandidateView } from "@/server/candidate/session";
import type { ScenarioInstance } from "@/engine/content/schemas";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";

/**
 * Réponses renvoyées au navigateur. Volontairement pauvres : ni score,
 * ni bonne réponse, ni détail de correction (règle n°1 et « pas de score
 * visible pour le candidat »).
 */
export type QuizResponse = { gem: true };
export type LogiqueResponse = { ok: true; gem: true } | { ok: false; retryAfterMs: number };
/**
 * SQL et Algo : seulement « X / Y » vérifications réussies, plus l'erreur
 * de la requête ou du code du candidat quand elle ne dépend d'aucune donnée
 * cachée (syntaxe, délai dépassé). Jamais de valeur attendue ni de sortie.
 */
export type CodeResponse = { ok: boolean; gem: boolean; passed: number; total: number; error?: string; retryAfterMs?: number };

export class TooSoonError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super("Trop tôt pour un nouvel essai");
  }
}

/**
 * Ajoute une gemme (sans doublon). Renvoie true si elle vient d'être
 * obtenue. L'événement `gem.obtained` est écrit par l'appelant, après
 * ceux qui l'expliquent, pour que le replay se lise dans l'ordre.
 */
async function markGem(db: Db, sessionId: string, gem: GemId): Promise<boolean> {
  const updated = await db
    .update(schema.sessions)
    .set({ gems: sql`array_append(${schema.sessions.gems}, ${gem})` })
    .where(and(eq(schema.sessions.id, sessionId), sql`not (${gem} = any(${schema.sessions.gems}))`))
    .returning({ id: schema.sessions.id });
  return updated.length > 0;
}

/** Lève TooSoonError si le dernier événement `type` date de moins de `ms` (heure serveur). */
async function assertCooldown(db: Db, sessionId: string, type: string, ms: number, now: Date) {
  const [last] = await db
    .select({ ts: schema.events.ts })
    .from(schema.events)
    .where(and(eq(schema.events.sessionId, sessionId), eq(schema.events.type, type)))
    .orderBy(desc(schema.events.seq))
    .limit(1);
  if (last) {
    const wait = last.ts.getTime() + ms - now.getTime();
    if (wait > 0) throw new TooSoonError(wait);
  }
}

/** Quiz : une seule tentative ; la gemme est acquise quel que soit le résultat. */
export async function submitQuiz(
  db: Db,
  view: CandidateView,
  stage: ScenarioInstance["stages"]["quiz"],
  answers: unknown,
  now: Date,
): Promise<QuizResponse> {
  assertCanSubmit(view, now);
  if (view.gems.includes("quiz")) return { gem: true }; // déjà soumis : on ne recorrige pas
  const grade = gradeQuiz(stage, answers); // lève MalformedAnswerError si besoin

  // Verrou implicite : markGem ne réussit qu'une fois, même en double clic.
  if (await markGem(db, view.sessionId, "quiz")) {
    await appendEvents(db, view.sessionId, "candidat", [{ type: "quiz.submit", payload: { answers: answers as Record<string, string> } }], now);
    await appendEvents(
      db,
      view.sessionId,
      "systeme",
      [
        { type: "quiz.result", payload: { correct: grade.correct, total: grade.total, details: grade.details } },
        { type: "gem.obtained", payload: { gem: "quiz" } },
      ],
      now,
    );
  }
  return { gem: true };
}

/** Énigme logique : essais illimités, espacés d'au moins LOGIQUE_COOLDOWN_MS. */
export async function submitLogique(
  db: Db,
  view: CandidateView,
  stage: ScenarioInstance["stages"]["logique"],
  rawAnswer: unknown,
  now: Date,
): Promise<LogiqueResponse> {
  assertCanSubmit(view, now);
  if (view.gems.includes("logique")) return { ok: true, gem: true };
  const { ok, answer } = checkLogique(stage, rawAnswer); // lève MalformedAnswerError si besoin

  await assertCooldown(db, view.sessionId, "logique.attempt", LOGIQUE_COOLDOWN_MS, now);
  await appendEvents(db, view.sessionId, "candidat", [{ type: "logique.attempt", payload: { answer, ok } }], now);
  if (ok) {
    if (await markGem(db, view.sessionId, "logique")) {
      await appendEvents(db, view.sessionId, "systeme", [{ type: "gem.obtained", payload: { gem: "logique" } }], now);
    }
    return { ok: true, gem: true };
  }
  return { ok: false, retryAfterMs: LOGIQUE_COOLDOWN_MS };
}

/**
 * Soumission SQL ou Algo (règle du 2026-11-12) : illimitée, espacée d'au
 * moins CODE_SUBMIT_COOLDOWN_MS ; gemme quand toutes les vérifications
 * passent. Le détail de la correction va au journal (recruteur), le
 * candidat ne reçoit que « X / Y ».
 */
async function submitCode(
  db: Db,
  view: CandidateView,
  gem: "sql" | "algo",
  now: Date,
  submission: Record<string, unknown>,
  grade: () => Promise<{ passed: number; total: number; publicError?: string; detail: Record<string, unknown> }>,
): Promise<CodeResponse> {
  await assertCooldown(db, view.sessionId, `${gem}.submit`, CODE_SUBMIT_COOLDOWN_MS, now);
  await appendEvents(db, view.sessionId, "candidat", [{ type: `${gem}.submit`, payload: submission }], now);

  const g = await grade(); // lève SandboxUnavailableError
  const ok = g.passed === g.total;
  const gemEvents = ok && (await markGem(db, view.sessionId, gem)) ? [{ type: "gem.obtained", payload: { gem } }] : [];
  await appendEvents(db, view.sessionId, "systeme", [{ type: `${gem}.result`, payload: g.detail }, ...gemEvents], now);
  return {
    ok,
    gem: ok,
    passed: g.passed,
    total: g.total,
    ...(g.publicError ? { error: g.publicError } : {}),
    ...(ok ? {} : { retryAfterMs: CODE_SUBMIT_COOLDOWN_MS }),
  };
}

/** Gemme SQL : jeu visible ET jeu caché (anti codage en dur). */
export async function submitSql(
  db: Db,
  view: CandidateView,
  stage: ScenarioInstance["stages"]["sql"],
  rawQuery: unknown,
  now: Date,
  run: RunJob,
): Promise<CodeResponse> {
  assertCanSubmit(view, now);
  if (view.gems.includes("sql")) return { ok: true, gem: true, passed: 2, total: 2 };
  const query = normalizeSqlQuery(rawQuery); // lève MalformedAnswerError
  return submitCode(db, view, "sql", now, { query }, async () => {
    const g = await gradeSql(stage, query, run);
    return { passed: g.passed, total: g.total, publicError: g.error, detail: g };
  });
}

/** Gemme Algo : tests cachés exécutés dans le bac à sable. */
export async function submitAlgo(
  db: Db,
  view: CandidateView,
  stage: ScenarioInstance["stages"]["algo"],
  rawCode: unknown,
  now: Date,
  run: RunJob,
): Promise<CodeResponse> {
  assertCanSubmit(view, now);
  const total = stage.private.hiddenTests.length;
  if (view.gems.includes("algo")) return { ok: true, gem: true, passed: total, total };
  const code = normalizePythonCode(rawCode); // lève MalformedAnswerError
  return submitCode(db, view, "algo", now, { code }, async () => {
    const g = await gradeAlgo(stage, code, run);
    return { passed: g.passed, total: g.total, publicError: g.publicError, detail: g };
  });
}
