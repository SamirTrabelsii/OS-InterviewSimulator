"use server";

import { revalidatePath } from "next/cache";
import { currentCandidate } from "@/server/candidate/current";
import { SessionError, startSession } from "@/server/candidate/session";
import { db } from "@/server/db/client";

export async function startSessionAction(): Promise<{ error?: string }> {
  const candidate = await currentCandidate();
  if (!candidate) return { error: "Session introuvable. Rouvrez votre lien personnel." };
  try {
    await startSession(db(), candidate.view.sessionId, new Date());
  } catch (err) {
    if (err instanceof SessionError) {
      const messages = {
        introuvable: "Session introuvable. Rouvrez votre lien personnel.",
        "pas-encore": "Il est encore un peu tôt : le départ sera possible à l'heure prévue.",
        termine: "Le temps de ce créneau est écoulé.",
        "hors-delai": "Ce créneau n'est plus ouvert.",
      } as const;
      return { error: messages[err.code] };
    }
    throw err;
  }
  revalidatePath("/session");
  return {};
}
