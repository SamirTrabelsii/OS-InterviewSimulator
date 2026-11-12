import { Suspense } from "react";
import { StageShell } from "../StageShell";
import { AlgoWorkbench } from "./AlgoWorkbench";

export default function AlgoPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <StageShell gem="algo">
          {({ content }) => {
            // Contenu PUBLIC uniquement : énoncé, signature, exemples.
            const stage = content.stages.algo;
            return (
              <div className="space-y-6">
                <p className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 dark:bg-emerald-950">{stage.statement}</p>
                <AlgoWorkbench starterCode={stage.starterCode} functionName={stage.signature.functionName} examples={stage.examples} />
              </div>
            );
          }}
        </StageShell>
      </Suspense>
    </main>
  );
}
