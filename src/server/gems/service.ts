import { and, desc, eq, sql } from "drizzle-orm";
import type { GemId } from "@/engine/timeline";
import { checkLogique, LOGIQUE_COOLDOWN_MS } from "@/engine/validators/logique";
import { gradeQuiz } from "@/engine/validators/quiz";
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

  const [last] = await db
    .select({ ts: schema.events.ts })
    .from(schema.events)
    .where(and(eq(schema.events.sessionId, view.sessionId), eq(schema.events.type, "logique.attempt")))
    .orderBy(desc(schema.events.seq))
    .limit(1);
  if (last) {
    const wait = last.ts.getTime() + LOGIQUE_COOLDOWN_MS - now.getTime();
    if (wait > 0) throw new TooSoonError(wait);
  }

  await appendEvents(db, view.sessionId, "candidat", [{ type: "logique.attempt", payload: { answer, ok } }], now);
  if (ok) {
    if (await markGem(db, view.sessionId, "logique")) {
      await appendEvents(db, view.sessionId, "systeme", [{ type: "gem.obtained", payload: { gem: "logique" } }], now);
    }
    return { ok: true, gem: true };
  }
  return { ok: false, retryAfterMs: LOGIQUE_COOLDOWN_MS };
}
