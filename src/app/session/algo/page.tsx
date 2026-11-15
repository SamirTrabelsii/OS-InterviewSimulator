import { Suspense } from "react";
import { PixelPanel } from "@/ui/pixel/components";
import { StageLoading } from "../StageLoading";
import { StageShell } from "../StageShell";
import { AlgoWorkbench } from "./AlgoWorkbench";

export default function AlgoPage() {
  return (
    <Suspense fallback={<StageLoading />}>
      <StageShell
        gem="algo"
        help={
          <ul className="px-rules">
            <li>« Tester les exemples » (ou Ctrl + Entrée) exécute votre code dans votre navigateur.</li>
            <li>« Soumettre » lance des tests que vous ne voyez pas, sur le serveur ; vous obtenez seulement « X / Y ».</li>
            <li>Soumissions illimitées, avec 3 secondes d&apos;attente entre deux.</li>
            <li>Un code trop lent est arrêté : pensez à la complexité.</li>
          </ul>
        }
      >
        {({ content }) => {
          // Contenu PUBLIC uniquement : énoncé, signature, exemples.
          const stage = content.stages.algo;
          return (
            <div className="px-stack">
              <PixelPanel tone="magenta" title="Mission">
                <p className="px-read px-story">{stage.statement}</p>
              </PixelPanel>
              <AlgoWorkbench starterCode={stage.starterCode} functionName={stage.signature.functionName} examples={stage.examples} />
            </div>
          );
        }}
      </StageShell>
    </Suspense>
  );
}
