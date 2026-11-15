import { Suspense } from "react";
import { StageLoading } from "../StageLoading";
import { StageShell } from "../StageShell";
import { QuizForm } from "./QuizForm";

export default function QuizPage() {
  return (
    <Suspense fallback={<StageLoading />}>
      <StageShell
        gem="quiz"
        help={
          <ul className="px-rules">
            <li>Une question à la fois : vous pouvez revenir en arrière avant de valider.</li>
            <li>Une seule validation est possible : relisez-vous.</li>
            <li>Aucune note n&apos;est affichée.</li>
          </ul>
        }
      >
        {({ content }) => <QuizForm questions={content.stages.quiz.questions} />}
      </StageShell>
    </Suspense>
  );
}
