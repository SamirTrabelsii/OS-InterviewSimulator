"use client";

import { useMemo, useRef, useState } from "react";
import type { SqlDataset } from "@/engine/content/schemas";
import { datasetToSql } from "@/engine/sql/setup";
import { CodeEditor } from "../CodeEditor";
import { SubmissionStatus, useCodeSnapshots, useSubmission } from "../code-stage";
import { trackEvent } from "../EventTracker";

const BROWSER_TIMEOUT_MS = 3_000;
const BROWSER_MAX_ROWS = 200;
const STARTER = "SELECT *\nFROM boutiques\nLIMIT 10;\n";

type RunResult =
  | { ok: true; columns: string[]; rows: unknown[][]; truncated: boolean; durationMs: number }
  | { ok: false; error: string; durationMs?: number };

/** Exécute la requête dans un Web Worker (sql.js), arrêté s'il dépasse le délai. */
function runInWorker(setup: string, query: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker("/workers/sql-worker.js");
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ ok: false, error: `Temps d'exécution dépassé (${BROWSER_TIMEOUT_MS / 1000} s)` });
    }, BROWSER_TIMEOUT_MS);
    worker.onmessage = (e: MessageEvent<RunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ok: false, error: "Le moteur SQL n'a pas pu démarrer." });
    };
    worker.postMessage({ id: 1, setup, query, maxRows: BROWSER_MAX_ROWS });
  });
}

const cell = (v: unknown) => (v === null ? "NULL" : String(v));

export function SqlWorkbench({ dataset, expectedColumns }: { dataset: SqlDataset; expectedColumns: string[] }) {
  const setup = useMemo(() => datasetToSql(dataset), [dataset]);
  const codeRef = useCodeSnapshots("sql", STARTER);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const runningRef = useRef(false);
  const { submit, pending, result, message, waitSeconds } = useSubmission("/api/session/gemmes/sql");

  async function execute() {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const query = codeRef.current;
    const r = await runInWorker(setup, query);
    setRun(r);
    trackEvent("code.run", {
      stage: "sql",
      query: query.slice(0, 15_000),
      ok: r.ok,
      ...(r.ok ? { rows: r.rows.length, truncated: r.truncated } : { error: r.error }),
    });
    runningRef.current = false;
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <CodeEditor language="sql" initialValue={STARTER} onChange={(v) => (codeRef.current = v)} onRun={() => void execute()} label="Requête SQL" />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void execute()}
          disabled={running}
          className="rounded-md border border-zinc-300 px-4 py-2 font-medium hover:border-indigo-400 disabled:opacity-50 dark:border-zinc-700"
        >
          {running ? "Exécution…" : "Exécuter"}
        </button>
        <button
          type="button"
          onClick={() => void submit({ query: codeRef.current })}
          disabled={pending || waitSeconds > 0}
          className="rounded-md bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {waitSeconds > 0 ? `Patientez ${waitSeconds} s` : pending ? "Vérification…" : "Soumettre"}
        </button>
        <span className="text-xs text-zinc-500">Ctrl + Entrée : exécuter sur le jeu visible. Colonnes attendues : {expectedColumns.join(", ")}.</span>
      </div>

      <SubmissionStatus result={result} message={message} what="Vérifications réussies" />

      {run && (
        <section aria-label="Résultat de la requête" className="space-y-2">
          {run.ok ? (
            <>
              <p className="text-xs text-zinc-500">
                {run.rows.length} ligne{run.rows.length > 1 ? "s" : ""}
                {run.truncated ? ` (affichage limité à ${BROWSER_MAX_ROWS})` : ""} · {run.durationMs} ms · jeu de données visible
              </p>
              <div className="max-h-80 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
                    <tr>
                      {run.columns.map((c, i) => (
                        <th key={i} className="px-3 py-1.5 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.rows.map((row, i) => (
                      <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                        {row.map((v, j) => (
                          <td key={j} className="px-3 py-1">
                            {cell(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="rounded-md bg-red-50 px-3 py-2 font-mono text-xs text-red-800 dark:bg-red-950 dark:text-red-200">{run.error}</p>
          )}
        </section>
      )}
    </div>
  );
}
