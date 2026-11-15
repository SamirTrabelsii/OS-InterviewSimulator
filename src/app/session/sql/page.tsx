import { Suspense } from "react";
import { PixelPanel } from "@/ui/pixel/components";
import { StageLoading } from "../StageLoading";
import { StageShell } from "../StageShell";
import { SqlWorkbench } from "./SqlWorkbench";

const PREVIEW_ROWS = 5;

export default function SqlPage() {
  return (
    <Suspense fallback={<StageLoading />}>
      <StageShell
        gem="sql"
        wide
        help={({ content }) => (
          <ul className="px-rules">
            <li>« Exécuter » (ou Ctrl + Entrée) lance votre requête sur le jeu de données visible.</li>
            <li>« Soumettre » la vérifie aussi sur un jeu que vous ne voyez pas ; vous obtenez seulement « X / Y ».</li>
            <li>Soumissions illimitées, avec 3 secondes d&apos;attente entre deux.</li>
            <li>Colonnes attendues : {content.stages.sql.expectedColumns.join(", ")}.</li>
          </ul>
        )}
      >
        {({ content }) => {
          // Contenu PUBLIC uniquement : énoncé et jeu de données visible.
          const stage = content.stages.sql;
          return (
            <div className="px-stack">
              <PixelPanel tone="green" title="Mission">
                <p className="px-read px-story">{stage.task}</p>
              </PixelPanel>

              <SqlWorkbench dataset={stage.dataset} />

              <PixelPanel tone="violet">
                <details className="px-details" open>
                  <summary>Tables disponibles (SQLite)</summary>
                  <div className="px-split" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
                    {stage.dataset.tables.map((t) => (
                      <section key={t.name} className="px-stack">
                        <h2 className="px-code" style={{ margin: 0, fontWeight: 700 }}>
                          {t.name} <span className="px-muted">({t.rows.length} lignes)</span>
                        </h2>
                        <p className="px-muted" style={{ margin: 0 }}>
                          {t.description}
                        </p>
                        <ul className="px-muted" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                          {t.columns.map((c) => (
                            <li key={c.name}>
                              <code className="px-code" style={{ fontWeight: 700 }}>
                                {c.name}
                              </code>{" "}
                              <span style={{ fontSize: "0.75rem" }}>{c.type}</span> — {c.description}
                            </li>
                          ))}
                        </ul>
                        <div className="px-table-wrap" style={{ maxHeight: "11rem" }}>
                          <table className="px-table">
                            <tbody>
                              {t.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                                <tr key={i}>
                                  {row.map((v, j) => (
                                    <td key={j}>{String(v)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </div>
                </details>
              </PixelPanel>
            </div>
          );
        }}
      </StageShell>
    </Suspense>
  );
}
