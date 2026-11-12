import "server-only";
import { MalformedAnswerError } from "@/engine/validators/errors";
import { currentCandidate } from "@/server/candidate/current";
import { SessionError } from "@/server/candidate/session";
import { loadInstance } from "@/server/content/registry";
import { TooSoonError } from "./service";
import type { CandidateView } from "@/server/candidate/session";
import type { ScenarioInstance } from "@/engine/content/schemas";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Enrobage commun des routes de soumission : session candidat, lecture du
 * corps, traduction des erreurs en réponses HTTP sans détail interne.
 */
export async function handleSubmission(
  request: Request,
  run: (ctx: { view: CandidateView; instance: ScenarioInstance; body: unknown; now: Date }) => Promise<unknown>,
): Promise<Response> {
  const candidate = await currentCandidate();
  if (!candidate) return json({ error: "Session inconnue." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Requête illisible." }, 400);
  }

  try {
    const instance = loadInstance(candidate.view.scenarioId, candidate.view.seed);
    return json(await run({ view: candidate.view, instance, body, now: candidate.now }));
  } catch (err) {
    if (err instanceof MalformedAnswerError) return json({ error: err.message }, 400);
    if (err instanceof TooSoonError) return json({ error: "Patientez un instant avant de réessayer.", retryAfterMs: err.retryAfterMs }, 429);
    if (err instanceof SessionError) {      return json({ error: err.code === "termine" ? "Le temps est écoulé." : "La session n'a pas commencé." }, 409);
    }
    throw err;
  }
}
