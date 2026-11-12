import { db } from "@/server/db/client";
import { handleSubmission } from "@/server/gems/http";
import { submitAlgo } from "@/server/gems/service";
import { getSandbox } from "@/server/sandbox/pool";

/** Corps : { code: "def …" }. Réponse : { ok, gem, passed, total, error? } (voir CodeResponse). */
export async function POST(request: Request) {
  return handleSubmission(request, ({ view, instance, body, now }) => {
    const sandbox = getSandbox();
    return submitAlgo(db(), view, instance.stages.algo, (body as { code?: unknown })?.code, now, (job) => sandbox.run(job));
  });
}
