import { Suspense } from "react";
import { StageShell } from "../StageShell";
import { LogiqueForm } from "./LogiqueForm";

export default function LogiquePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <StageShell gem="logique">
          {({ content }) => {
            const stage = content.stages.logique;
            return (
              <div className="space-y-6">
                <p>{stage.puzzle}</p>
                <ol className="space-y-1 rounded-lg bg-zinc-50 p-4 font-mono dark:bg-zinc-900">
                  {stage.clues.map((clue) => (
                    <li key={clue}>{clue}</li>
                  ))}
                </ol>
                <LogiqueForm answerFormat={stage.answerFormat} answerPattern={stage.answerPattern} />
              </div>
            );
          }}
        </StageShell>
      </Suspense>
    </main>
  );
}
