import { Suspense } from "react";
import { StageShell } from "../StageShell";
import { QuizForm } from "./QuizForm";

export default function QuizPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <StageShell gem="quiz">{({ content }) => <QuizForm questions={content.stages.quiz.questions} />}</StageShell>
      </Suspense>
    </main>
  );
}
