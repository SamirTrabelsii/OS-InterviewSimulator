import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/server/db/client";
import { CANDIDATE_COOKIE, decodeCandidateCookie } from "./cookie";
import { loadCandidateView, type CandidateView } from "./session";

/** Candidat de la requête courante (cookie signé), avec l'heure serveur utilisée. */
export async function currentCandidate(): Promise<{ view: CandidateView; deviceId: string; now: Date } | null> {
  await connection(); // l'heure serveur et le cookie sont propres à chaque requête
  const cookie = decodeCandidateCookie((await cookies()).get(CANDIDATE_COOKIE)?.value);
  if (!cookie) return null;
  const now = new Date();
  const view = await loadCandidateView(db(), cookie.sessionId, now);
  return view ? { view, deviceId: cookie.deviceId, now } : null;
}
