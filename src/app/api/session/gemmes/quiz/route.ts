import { db } from "@/server/db/client";
import { handleSubmission } from "@/server/gems/http";
import { submitQuiz } from "@/server/gems/service";

/** Corps : { answers: { [idQuestion]: idChoix } }. Réponse : { gem: true }. */
export async function POST(request: Request) {
  return handleSubmission(request, ({ view, instance, body, now }) =>
    submitQuiz(db(), view, instance.stages.quiz, (body as { answers?: unknown })?.answers, now),
  );
}
