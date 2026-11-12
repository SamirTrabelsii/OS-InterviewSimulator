import { currentCandidate } from "@/server/candidate/current";
import { appendEvents, clientEventBatch } from "@/server/candidate/events";
import { acceptsClientEvents } from "@/server/candidate/session";
import { db } from "@/server/db/client";

/** Lot d'événements envoyés par le navigateur du candidat (focus, étapes…). */
export async function POST(request: Request) {
  const candidate = await currentCandidate();
  if (!candidate) return Response.json({ error: "Session inconnue" }, { status: 401 });
  if (!acceptsClientEvents(candidate.view, candidate.now)) {
    return Response.json({ error: "Session terminée" }, { status: 410 });
  }

  const raw = await request.text();
  if (raw.length > 256 * 1024) return Response.json({ error: "Lot trop volumineux" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }
  const parsed = clientEventBatch.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Événements invalides" }, { status: 400 });

  const seqs = await appendEvents(
    db(),
    candidate.view.sessionId,
    "candidat",
    parsed.data.map((e) => ({ type: e.type, payload: { ...e.payload, clientTs: e.clientTs, deviceId: candidate.deviceId } })),
  );
  return Response.json({ seqs, serverNow: candidate.now.toISOString() });
}
