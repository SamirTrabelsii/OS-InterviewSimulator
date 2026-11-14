// Raccourcis RÉSERVÉS AU DEV. Même règle que la connexion de test
// (voir devLoginEnabled) : jamais actifs si NODE_ENV === "production".
import { and, eq, ne } from "drizzle-orm";
import { deadlineFrom, GEM_IDS } from "@/engine/timeline";
import { appendEvents } from "@/server/candidate/events";
import * as schema from "@/server/db/schema";
import { devLoginEnabled } from "@/server/auth/policy";
import { regenerateLink, type Db } from "@/server/slots/service";

export function devShortcutsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return devLoginEnabled(env);
}

export class DevShortcutError extends Error {}

/**
 * Démarre le créneau maintenant, donne les 4 gemmes à tous les candidats
 * actifs (le Portail s'ouvre alors tout de suite) et régénère leurs liens
 * personnels, retournés pour être ouverts dans deux navigateurs.
 * Journalisé (« dev.portail.ouvert »).
 */
export async function devOpenPortal(
  db: Db,
  slotId: string,
  now: Date,
  env: Record<string, string | undefined> = process.env,
): Promise<{ sessionId: string; name: string; token: string }[]> {
  if (!devShortcutsEnabled(env)) throw new DevShortcutError("Raccourci indisponible");

  const ids = await db.transaction(async (tx) => {
    const [slot] = await tx.select().from(schema.slots).where(eq(schema.slots.id, slotId)).for("update").limit(1);
    if (!slot) throw new DevShortcutError("Créneau introuvable");
    const t0 = slot.startedAt ?? now;
    const deadline = deadlineFrom(t0);
    if (now >= deadline) throw new DevShortcutError("Le temps de ce créneau est écoulé");
    if (!slot.startedAt) await tx.update(schema.slots).set({ startedAt: t0, status: "en_cours" }).where(eq(schema.slots.id, slotId));
    const active = await tx
      .select({ id: schema.sessions.id, startedAt: schema.sessions.startedAt })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.slotId, slotId), ne(schema.sessions.status, "expiree")));
    for (const s of active) {
      await tx
        .update(schema.sessions)
        .set({ startedAt: s.startedAt ?? now, deadline, status: "en_cours", gems: [...GEM_IDS] })
        .where(eq(schema.sessions.id, s.id));
    }
    return active.map((s) => s.id);
  });

  const links: { sessionId: string; name: string; token: string }[] = [];
  for (const id of ids) {
    const l = await regenerateLink(db, id);
    links.push({ sessionId: l.sessionId, name: l.candidateName, token: l.token });
    await appendEvents(db, id, "systeme", [{ type: "dev.portail.ouvert", payload: { raccourci: "dev" } }], now);
  }
  return links;
}
