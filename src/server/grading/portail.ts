import "server-only";
import type { ScenarioInstance } from "@/engine/content/schemas";
import { jsonEqual, normalizePythonCode } from "@/engine/validators/algo";
import { SandboxUnavailableError, type RunJob } from "./sql";

type PortailStage = ScenarioInstance["stages"]["portail"];

export type PortailGrade = {
  passed: number;
  total: number;
  /** Détail par test (hidden puis exemples), pour le replay recruteur uniquement. */
  cases: { ok: boolean; durationMs?: number; error?: string }[];
  /**
   * Lignes de journal pour le COPILOTE : uniquement les exemples publics
   * (déjà visibles dans son énoncé) et l'erreur de compilation. Jamais un
   * test caché.
   */
  logLines: string[];
  /** Erreur montrable sans fuite (compilation, délai). */
  publicError?: string;
  durationMs: number;
};

const clip = (v: unknown, n = 160) => {
  const s = JSON.stringify(v) ?? "undefined";
  return s.length > n ? `${s.slice(0, n)}…` : s;
};
const hhmmss = (d: Date) => d.toISOString().slice(11, 19);

/**
 * Valide le code corrigé du binôme : tests cachés + exemples publics dans
 * un seul passage du bac à sable. Les attendus des tests cachés ne
 * quittent jamais ce module.
 */
export async function gradePortail(stage: PortailStage, rawCode: unknown, run: RunJob, now: Date = new Date()): Promise<PortailGrade> {
  const code = normalizePythonCode(rawCode); // lève MalformedAnswerError
  const hidden = stage.private.hiddenTests;
  const examples = stage.public.examples;
  const all = [...hidden, ...examples];
  const r = await run({
    kind: "python",
    code,
    call: { fn: stage.public.signature.functionName, cases: all.map((t) => t.args) as never },
  });
  if (r.status === "busy" || r.status === "crash") throw new SandboxUnavailableError(r.status);

  const values = new Map<number, (typeof r.cases)[number]>(r.cases.map((c) => [c.index, c]));
  const cases = all.map((t, i) => {
    const c = values.get(i);
    if (!c) return { ok: false };
    if (!c.ok) return { ok: false, durationMs: c.durationMs, error: c.error };
    return { ok: jsonEqual(c.value, t.expected), durationMs: c.durationMs };
  });
  const hiddenCases = cases.slice(0, hidden.length);
  const passed = hiddenCases.filter((c) => c.ok).length;

  const fn = stage.public.signature.functionName;
  const t = hhmmss(now);
  const publicError = r.status === "ok" ? undefined : r.status === "error" ? r.error : (r.error ?? "Exécution interrompue");
  const logLines = [`${t} INFO  exécution de ${fn} sur ${examples.length} exemple(s)`];
  if (publicError) logLines.push(`${t} ERROR ${publicError}`);
  examples.forEach((ex, k) => {
    const idx = hidden.length + k;
    const c = values.get(idx);
    if (!c) return;
    if (!c.ok) {
      logLines.push(`${t} ERROR exemple ${k + 1} : exception levée`);
      return;
    }
    const ok = jsonEqual(c.value, ex.expected);
    logLines.push(
      `${t} ${ok ? "INFO  " : "WARN  "}exemple ${k + 1} ${ok ? "OK" : "ÉCART"} : obtenu ${clip(c.value)} · attendu ${clip(ex.expected)}`,
    );
  });
  logLines.push(`${t} INFO  vérifications : ${passed} / ${hidden.length}`);

  return { passed, total: hidden.length, cases, logLines, ...(publicError ? { publicError } : {}), durationMs: r.durationMs };
}
