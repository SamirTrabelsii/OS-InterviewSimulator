import { z } from "zod";
import type { ScenarioInstance } from "@/engine/content/schemas";
import { MalformedAnswerError } from "./errors";

type QuizStage = ScenarioInstance["stages"]["quiz"];

export const quizAnswersSchema = z.record(z.string(), z.string());

export type QuizGrade = {
  correct: number;
  total: number;
  /** Détail par question, pour le replay recruteur uniquement. */
  details: Record<string, { given: string; expected: string; ok: boolean }>;
};

/**
 * Corrige le quiz. Règle (décision du 2026-11-12) : une seule tentative,
 * la gemme est acquise quel que soit le résultat ; la correction ne sert
 * qu'au recruteur et n'est jamais renvoyée au candidat.
 */
export function gradeQuiz(stage: QuizStage, raw: unknown): QuizGrade {
  const parsed = quizAnswersSchema.safeParse(raw);
  if (!parsed.success) throw new MalformedAnswerError("Réponses illisibles.");
  const answers = parsed.data;

  const questions = stage.public.questions;
  const ids = new Set(questions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
    if (!ids.has(key)) throw new MalformedAnswerError("Question inconnue.");
  }

  const details: QuizGrade["details"] = {};
  let correct = 0;
  for (const q of questions) {
    const given = answers[q.id];
    if (given === undefined) throw new MalformedAnswerError("Répondez à toutes les questions.");
    if (!q.choices.some((c) => c.id === given)) throw new MalformedAnswerError("Choix inconnu.");
    const expected = stage.private.answers[q.id];
    const ok = given === expected;
    if (ok) correct++;
    details[q.id] = { given, expected, ok };
  }
  return { correct, total: questions.length, details };
}
