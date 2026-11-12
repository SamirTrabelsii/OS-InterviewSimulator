import { Suspense } from "react";
import { StageShell } from "../StageShell";
import { SqlWorkbench } from "./SqlWorkbench";

const PREVIEW_ROWS = 5;

export default function SqlPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <StageShell gem="sql">
          {({ content }) => {
            // Contenu PUBLIC uniquement : énoncé et jeu de données visible.
            const stage = content.stages.sql;
            return (
              <div className="space-y-6">
                <p className="rounded-lg border-l-4 border-sky-500 bg-sky-50 px-4 py-3 dark:bg-sky-950">{stage.task}</p>

                <details className="rounded-lg border border-zinc-200 dark:border-zinc-800" open>
                  <summary className="cursor-pointer px-4 py-2 font-medium">Tables disponibles (SQLite)</summary>
                  <div className="grid gap-4 p-4 lg:grid-cols-3">
                    {stage.dataset.tables.map((t) => (
                      <section key={t.name} className="space-y-2 text-sm">
                        <h2 className="font-mono font-semibold">
                          {t.name} <span className="font-sans font-normal text-zinc-500">({t.rows.length} lignes)</span>
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-400">{t.description}</p>
                        <ul className="space-y-0.5">
                          {t.columns.map((c) => (
                            <li key={c.name}>
                              <code className="font-semibold">{c.name}</code> <span className="text-xs text-zinc-500">{c.type}</span> — {c.description}
                            </li>
                          ))}
                        </ul>
                        <table className="w-full font-mono text-xs">
                          <tbody>
                            {t.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                              <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                                {row.map((v, j) => (
                                  <td key={j} className="py-0.5 pr-2">
                                    {String(v)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    ))}
                  </div>
                </details>

                <SqlWorkbench dataset={stage.dataset} expectedColumns={stage.expectedColumns} />
              </div>
            );
          }}
        </StageShell>
      </Suspense>
    </main>
  );
}
