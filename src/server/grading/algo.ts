import "server-only";
import type { ScenarioInstance } from "@/engine/content/schemas";
import { jsonEqual, normalizePythonCode } from "@/engine/validators/algo";
import type { SandboxStatus } from "@/server/sandbox/protocol";
import { SandboxUnavailableError, type RunJob } from "./sql";

type AlgoStage = ScenarioInstance["stages"]["algo"];

export type AlgoGrade = {
  /** Tests cachés réussis sur `total`. */
  passed: number;
  total: number;
  /** Pour le replay recruteur uniquement (peut contenir des données cachées). */
  status: SandboxStatus;
  cases: { ok: boolean; durationMs?: number; error?: string }[];
  /**
   * Erreur montrable au candidat : uniquement ce qui ne dépend d'aucune
   * entrée cachée (code qui ne compile pas, délai, mémoire). Jamais
   * l'erreur d'un test, jamais la sortie standard.
   */
  publicError?: string;
  durationMs: number;
};

/**
 * Exécute la fonction du candidat sur les tests cachés, dans le bac à
 * sable. L'enfant ne reçoit que les arguments ; la comparaison avec les
 * attendus se fait ici, dans le serveur.
 */
export async function gradeAlgo(stage: AlgoStage, rawCode: unknown, run: RunJob): Promise<AlgoGrade> {
  const code = normalizePythonCode(rawCode); // lève MalformedAnswerError
  const tests = stage.private.hiddenTests;
  const r = await run({
    kind: "python",
    code,
    call: { fn: stage.public.signature.functionName, cases: tests.map((t) => t.args) as never },
  });
  if (r.status === "busy" || r.status === "crash") throw new SandboxUnavailableError(r.status);

  const cases = tests.map((t, i) => {
    const c = r.cases.find((x) => x.index === i);
    if (!c) return { ok: false };
    if (!c.ok) return { ok: false, durationMs: c.durationMs, error: c.error };
    return { ok: jsonEqual(c.value, t.expected), durationMs: c.durationMs };
  });

  // En mode `call`, le statut « error » ne vient que de la compilation du
  // code du candidat (avant toute entrée cachée) : son message est sûr.
  const publicError = r.status === "ok" ? undefined : r.status === "error" ? r.error : (r.error ?? "Exécution interrompue");
  return {
    passed: cases.filter((c) => c.ok).length,
    total: tests.length,
    status: r.status,
    cases,
    ...(publicError ? { publicError } : {}),
    durationMs: r.durationMs,
  };
}
