// Gemme Algo : règles pures (sans bac à sable). L'exécution est dans
// src/server/grading/algo.ts ; le navigateur réutilise jsonEqual pour
// comparer les exemples publics.
import { MalformedAnswerError } from "./errors";

export const MAX_PYTHON_CODE_CHARS = 50_000;

export function normalizePythonCode(raw: unknown): string {
  if (typeof raw !== "string") throw new MalformedAnswerError("Code illisible.");
  if (!raw.trim()) throw new MalformedAnswerError("Écrivez du code avant de soumettre.");
  if (raw.length > MAX_PYTHON_CODE_CHARS) throw new MalformedAnswerError("Code trop long.");
  return raw;
}

/**
 * Égalité de deux valeurs JSON : l'ordre des clés d'un objet (dict Python)
 * ne compte pas, l'ordre des éléments d'une liste compte.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => jsonEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) => Object.hasOwn(b, k) && jsonEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
    );
  }
  return false;
}
