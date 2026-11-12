import { db } from "@/server/db/client";
import { handleSubmission } from "@/server/gems/http";
import { submitSql } from "@/server/gems/service";
import { getSandbox } from "@/server/sandbox/pool";

/** Corps : { query: "SELECT …" }. Réponse : { ok, gem, passed, total, error? } (voir CodeResponse). */
export async function POST(request: Request) {
  return handleSubmission(request, ({ view, instance, body, now }) => {
    const sandbox = getSandbox();
    return submitSql(db(), view, instance.stages.sql, (body as { query?: unknown })?.query, now, (job) => sandbox.run(job));
  });
}
