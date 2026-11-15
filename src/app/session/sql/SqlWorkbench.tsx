"use client";

import { useMemo, useRef, useState } from "react";
import type { SqlDataset } from "@/engine/content/schemas";
import { datasetToSql } from "@/engine/sql/setup";
import { CodeEditor } from "../CodeEditor";
import { SubmissionStatus, useCodeSnapshots, useSubmission } from "../code-stage";
import { trackEvent } from "../EventTracker";
import { PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";

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

export function SqlWorkbench({ dataset }: { dataset: SqlDataset }) {
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
    <div className="px-stack">
      <PixelPanel tone="green" title="Votre requête">
        <CodeEditor night language="sql" initialValue={STARTER} onChange={(v) => (codeRef.current = v)} onRun={() => void execute()} label="Requête SQL" />
        <div className="px-actions">
          <PixelButton variant="primary" onClick={() => void submit({ query: codeRef.current })} disabled={pending || waitSeconds > 0}>
            {waitSeconds > 0 ? `Patientez ${waitSeconds} s` : pending ? "Vérification…" : "Soumettre"}
          </PixelButton>
          <PixelButton onClick={() => void execute()} disabled={running}>
            {running ? "Exécution…" : "Exécuter"}
          </PixelButton>
        </div>
      </PixelPanel>

      <SubmissionStatus result={result} message={message} what="Vérifications réussies" />

      {run && (
        <PixelPanel tone="violet" title="Résultat de la requête">
          {run.ok ? (
            <>
              <p className="px-muted" style={{ margin: "0 0 0.5rem" }}>
                {run.rows.length} ligne{run.rows.length > 1 ? "s" : ""}
                {run.truncated ? ` (affichage limité à ${BROWSER_MAX_ROWS})` : ""} · {run.durationMs} ms · jeu de données visible
              </p>
              <div className="px-table-wrap">
                <table className="px-table">
                  <thead>
                    <tr>
                      {run.columns.map((c, i) => (
                        <th key={i}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.rows.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td key={j}>{cell(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <PixelStatus tone="bad">
              <p>
                <code>{run.error}</code>
              </p>
            </PixelStatus>
          )}
        </PixelPanel>
      )}
    </div>
  );
}
