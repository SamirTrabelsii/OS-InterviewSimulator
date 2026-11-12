import { db } from "@/server/db/client";
import { handleSubmission } from "@/server/gems/http";
import { submitLogique } from "@/server/gems/service";

/** Corps : { answer: "1234" }. Réponse : { ok, gem } ou { ok: false, retryAfterMs }. */
export async function POST(request: Request) {
  return handleSubmission(request, ({ view, instance, body, now }) =>
    submitLogique(db(), view, instance.stages.logique, (body as { answer?: unknown })?.answer, now),
  );
}
