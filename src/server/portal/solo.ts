import { and, eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { appendEvents } from "@/server/candidate/events";
import type { Db } from "@/server/slots/service";

export class SoloError extends Error {
  constructor(
    public readonly code: "introuvable" | "pas-demarre" | "deja-solo" | "session-invalide",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Repli solo (décision du recruteur) : un candidat de binôme est absent.
 * On garde `keepSessionId` ; les autres sessions du créneau sont closes
 * (statut « expirée ») et ne retiennent plus l'ouverture du Portail. Le
 * créneau devient « solo » : même énigme, un seul candidat (pilote et
 * copilote à la fois). Irréversible pour le créneau. Journalisé.
 */
export async function switchToSolo(db: Db, slotId: string, keepSessionId: string, recruiterEmail: string, now: Date): Promise<{ retired: string[] }> {
  const retired = await db.transaction(async (tx) => {
    const [slot] = await tx.select().from(schema.slots).where(eq(schema.slots.id, slotId)).for("update").limit(1);
    if (!slot) throw new SoloError("introuvable", "Créneau introuvable");
    if (slot.mode === "solo") throw new SoloError("deja-solo", "Ce créneau est déjà en solo");
    if (!slot.startedAt) throw new SoloError("pas-demarre", "Le créneau n'a pas démarré");
    const sessions = await tx.select().from(schema.sessions).where(eq(schema.sessions.slotId, slotId));
    const keep = sessions.find((s) => s.id === keepSessionId);
    if (!keep || keep.status === "expiree" || !keep.startedAt) throw new SoloError("session-invalide", "Ce candidat ne peut pas poursuivre seul");
    const others = sessions.filter((s) => s.id !== keepSessionId && s.status !== "expiree");
    for (const o of others) {
      await tx.update(schema.sessions).set({ status: "expiree" }).where(and(eq(schema.sessions.id, o.id)));
    }
    await tx.update(schema.slots).set({ mode: "solo" }).where(eq(schema.slots.id, slotId));
    return others.map((o) => o.id);
  });
  for (const id of [keepSessionId, ...retired]) {
    await appendEvents(db, id, "recruteur", [{ type: "portail.solo", payload: { kept: keepSessionId, retired, by: recruiterEmail } }], now);
  }
  return { retired };
}
