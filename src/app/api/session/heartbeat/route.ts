import { eq } from "drizzle-orm";
import { currentCandidate } from "@/server/candidate/current";
import { db } from "@/server/db/client";
import { sessions } from "@/server/db/schema";

/**
 * Battement du navigateur du candidat (toutes les 15 s) : alimente
 * « connecté » / « hors ligne » vu par le binôme sur le quartier.
 * N'écrit pas dans le journal (pas de bruit dans le replay).
 */
export async function POST() {
  const candidate = await currentCandidate();
  if (!candidate) return Response.json({ error: "Session inconnue" }, { status: 401 });
  await db().update(sessions).set({ lastSeenAt: candidate.now }).where(eq(sessions.id, candidate.view.sessionId));
  return Response.json({ ok: true });
}
