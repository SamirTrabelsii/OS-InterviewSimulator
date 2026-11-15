"use client";

import { useEffect, useRef, useState } from "react";
import { jsonEqual } from "@/engine/validators/algo";
import { CodeEditor } from "../CodeEditor";
import { DraftNote, EditorPlaceholder, SubmissionStatus, useCodeSnapshots, useDraft, useSubmission } from "../code-stage";
import { trackEvent } from "../EventTracker";
import { PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";

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
  const draft = useDraft("algo", starterCode, codeRef);
  const runner = useRef<PythonRunner | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [stale, setStale] = useState(false);
  const { submit, pending, result, message, waitSeconds, reset } = useSubmission("/api/session/gemmes/algo");
  const onEdit = (v: string) => {
    draft.onChange(v);
    reset();
    setStale(true);
  };

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
    setStale(false);
    const passed = r.ok ? r.results.filter((c, i) => c.ok && jsonEqual(c.value, examples[i].expected)).length : 0;
    trackEvent("code.run", { stage: "algo", code: code.slice(0, 15_000), passed, total: examples.length, ...(r.ok ? {} : { error: r.error }) });
    setRunning(false);
  }

  return (
    <div className="px-stack">
      <PixelPanel tone="magenta" title="Votre code">
        {draft.initial === null ? (
          <EditorPlaceholder height={320} />
        ) : (
          <CodeEditor
            night
            language="python"
            initialValue={draft.initial}
            onChange={onEdit}
            onRun={() => void execute()}
            label="Code Python"
            height={320}
          />
        )}
        <div className="px-actions">
          <PixelButton variant="primary" onClick={() => void submit({ code: codeRef.current })} disabled={pending || waitSeconds > 0}>
            {waitSeconds > 0 ? `Patientez ${waitSeconds} s` : pending ? "Tests en cours…" : "Soumettre"}
          </PixelButton>
          <PixelButton onClick={() => void execute()} disabled={running}>
            {running ? (loading ? "Chargement de Python…" : "Exécution…") : "Tester les exemples"}
          </PixelButton>
        </div>
        <p className="px-muted" style={{ margin: 0 }}>
          <strong>Tester les exemples</strong> : essai libre dans votre navigateur (Ctrl + Entrée). <strong>Soumettre</strong> : tests cachés sur le serveur ; vous
          obtenez « X / Y ».
        </p>
        {loading && <p className="px-muted">Python se charge dans votre navigateur…</p>}
        <DraftNote savedAt={draft.savedAt} />
      </PixelPanel>

      <SubmissionStatus result={result} message={message} what="Tests cachés réussis" />

      {run && !run.ok && !stale && (
        <PixelStatus tone="bad">
          <p>
            <code>{run.error}</code>
          </p>
        </PixelStatus>
      )}

      <PixelPanel tone="violet">
        <details className="px-details" open>
          <summary>Exemples</summary>
          {run && stale && (
            <p className="px-muted" role="status">
              Résultats de la version précédente de votre code : testez à nouveau pour les mettre à jour.
            </p>
          )}
          <ol className="px-cards">
            {examples.map((ex, i) => {
              const c = run?.ok && !stale ? run.results[i] : undefined;
              const ok = c?.ok && jsonEqual(c.value, ex.expected);
              return (
                <li key={i} className="px-card" data-state={c ? (ok ? "ok" : "bad") : undefined}>
                  <p className="px-card-title">
                    Exemple {i + 1}
                    {c && <span> — {ok ? "réussi" : "échoué"}</span>}
                  </p>
                  <p>
                    {functionName}({ex.args.map(show).join(", ")})
                  </p>
                  <p>attendu : {show(ex.expected)}</p>
                  {c && <p>obtenu : {c.ok ? show(c.value) : c.error}</p>}
                  {c?.output && <pre>{c.output}</pre>}
                </li>
              );
            })}
          </ol>
        </details>
      </PixelPanel>
    </div>
  );
}
