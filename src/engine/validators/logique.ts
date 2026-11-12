import type { ScenarioInstance } from "@/engine/content/schemas";
import { MalformedAnswerError } from "./errors";

type LogiqueStage = ScenarioInstance["stages"]["logique"];

/** Délai minimal entre deux essais (anti force brute, appliqué côté serveur). */
export const LOGIQUE_COOLDOWN_MS = 5_000;

export function normalizeLogiqueAnswer(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
}

/**
 * Vérifie la réponse à l'énigme. Essais illimités (avec délai) : une
 * mauvaise réponse est simplement « le cadenas ne s'ouvre pas ».
 */
export function checkLogique(stage: LogiqueStage, raw: unknown): { ok: boolean; answer: string } {
  const answer = normalizeLogiqueAnswer(raw);
  if (!new RegExp(stage.public.answerPattern).test(answer)) {
    throw new MalformedAnswerError(`Format attendu : ${stage.public.answerFormat}.`);
  }
  return { ok: answer === stage.private.answer, answer };
}
