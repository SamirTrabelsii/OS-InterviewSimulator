import { Suspense } from "react";
import { PixelPanel } from "@/ui/pixel/components";
import { StageLoading } from "../StageLoading";
import { StageShell } from "../StageShell";
import { LogiqueForm } from "./LogiqueForm";

export default function LogiquePage() {
  return (
    <Suspense fallback={<StageLoading />}>
      <StageShell
        gem="logique"
        help={
          <ul className="px-rules">
            <li>Les essais sont illimités.</li>
            <li>Comptez 5 secondes d&apos;attente entre deux essais.</li>
            <li>Lisez tous les indices : chacun élimine des possibilités.</li>
          </ul>
        }
      >
        {({ content }) => {
          const stage = content.stages.logique;
          return (
            <div className="px-stack">
              <PixelPanel tone="amber" title="L'énigme">
                <p className="px-read px-story">{stage.puzzle}</p>
                <ol className="px-code" style={{ margin: "1rem 0 0", paddingLeft: "1.5rem", lineHeight: 1.8 }}>
                  {stage.clues.map((clue) => (
                    <li key={clue}>{clue}</li>
                  ))}
                </ol>
              </PixelPanel>
              <LogiqueForm answerFormat={stage.answerFormat} answerPattern={stage.answerPattern} />
            </div>
          );
        }}
      </StageShell>
    </Suspense>
  );
}
