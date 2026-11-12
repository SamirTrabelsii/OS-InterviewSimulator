"use client";

import { useEffect, useRef, useState } from "react";
import { jsonEqual } from "@/engine/validators/algo";
import { CodeEditor } from "../CodeEditor";
import { SubmissionStatus, useCodeSnapshots, useSubmission } from "../code-stage";
import { trackEvent } from "../EventTracker";

type Example = { args: unknown[]; expected: unknown };
type CaseRun = { ok: boolean; value?: unknown; error?: string; output: string; durationMs: number };
type Run = { ok: true; results: CaseRun[] } | { ok: false; error: string };

/** Délai d'exécution des exemples dans le navigateur (chargement de Pyodide non compris). */
const RUN_TIMEOUT_MS = 5_000;

/**
 * Pyodide dans un Web Worker, chargé une fois et gardé entre deux
 * exécutions ; arrêté et recréé si une exécution dépasse le délai.
 */
class PythonRunner {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;

  private start() {
    const worker = new Worker("/workers/python-worker.mjs", { type: "module" });
    this.worker = worker;
    this.ready = new Promise((resolve, reject) => {
      worker.addEventListener("message", function onReady(e: MessageEvent<{ type: string }>) {
        if (e.data.type === "ready") {
          worker.removeEventListener("message", onReady);
          resolve();
        }
      });
      worker.addEventListener("error", () => reject(new Error("Python n'a pas pu démarrer.")), { once: true });
    });
  }

  /** Démarre le chargement à l'avance (quelques secondes). */
  warm() {
    if (!this.worker) this.start();
    return this.ready!;
  }

  async run(code: string, fn: string, cases: unknown[][]): Promise<Run> {
    try {
      await this.warm();
    } catch (e) {
      this.stop();
      return { ok: false, error: (e as Error).message };
    }
    const worker = this.worker!;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.stop();
        resolve({ ok: false, error: `Temps d'exécution dépassé (${RUN_TIMEOUT_MS / 1000} s)` });
      }, RUN_TIMEOUT_MS);
      const onMessage = (e: MessageEvent<{ type: string; results: CaseRun[] }>) => {
        if (e.data.type !== "result") return;
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        resolve({ ok: true, results: e.data.results });
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage({ id: Date.now(), code, fn, cases });
    });
  }

  stop() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }
}

const show = (v: unknown) => JSON.stringify(v);

export function AlgoWorkbench({ starterCode, functionName, examples }: { starterCode: string; functionName: string; examples: Example[] }) {
  const codeRef = useCodeSnapshots("algo", starterCode);
  const runner = useRef<PythonRunner | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const { submit, pending, result, message, waitSeconds } = useSubmission("/api/session/gemmes/algo");

  useEffect(() => {
    const r = new PythonRunner();
    runner.current = r;
    r.warm()
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => r.stop();
  }, []);

  async function execute() {
    if (running || !runner.current) return;
    setRunning(true);
    const code = codeRef.current;
    const r = await runner.current.run(
      code,
      functionName,
      examples.map((e) => e.args),
    );
    setRun(r);
    const passed = r.ok ? r.results.filter((c, i) => c.ok && jsonEqual(c.value, examples[i].expected)).length : 0;
    trackEvent("code.run", { stage: "algo", code: code.slice(0, 15_000), passed, total: examples.length, ...(r.ok ? {} : { error: r.error }) });
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <CodeEditor
        language="python"
        initialValue={starterCode}
        onChange={(v) => (codeRef.current = v)}
        onRun={() => void execute()}
        label="Code Python"
        height={320}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void execute()}
          disabled={running}
          className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:border-indigo-400 disabled:opacity-50 dark:border-zinc-700"
        >
          {running ? (loading ? "Chargement de Python…" : "Exécution…") : "Tester les exemples"}
        </button>
        <button
          type="button"
          onClick={() => void submit({ code: codeRef.current })}
          disabled={pending || waitSeconds > 0}
          className="rounded-md bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {waitSeconds > 0 ? `Patientez ${waitSeconds} s` : pending ? "Tests en cours…" : "Soumettre"}
        </button>
        <span className="text-xs text-zinc-500">
          {loading ? "Python se charge dans votre navigateur…" : "Ctrl + Entrée : tester les exemples."} La soumission lance des tests
          cachés sur le serveur.
        </span>
      </div>

      <SubmissionStatus result={result} message={message} what="Tests cachés réussis" />

      {run && !run.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 font-mono text-xs text-red-800 dark:bg-red-950 dark:text-red-200">{run.error}</p>
      )}
      <ol className="space-y-3">
        {examples.map((ex, i) => {
          const c = run?.ok ? run.results[i] : undefined;
          const ok = c?.ok && jsonEqual(c.value, ex.expected);
          return (
            <li key={i} className="space-y-1 rounded-lg border border-zinc-200 p-3 font-mono text-xs dark:border-zinc-800">
              <p className="font-sans text-sm font-medium">
                Exemple {i + 1}
                {c && <span className={ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}> — {ok ? "réussi" : "échoué"}</span>}
              </p>
              <p>
                {functionName}({ex.args.map(show).join(", ")})
              </p>
              <p>attendu : {show(ex.expected)}</p>
              {c && <p>obtenu : {c.ok ? show(c.value) : c.error}</p>}
              {c?.output && <pre className="max-h-32 overflow-auto whitespace-pre-wrap bg-zinc-50 p-2 dark:bg-zinc-900">{c.output}</pre>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
