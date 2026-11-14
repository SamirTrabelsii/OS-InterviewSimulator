import { eq, sql } from "drizzle-orm";
import { cookieValue } from "./cookies";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";
import { appendEvents } from "@/server/candidate/events";
import { CANDIDATE_COOKIE, decodeCandidateCookie } from "@/server/candidate/cookie";
import type { Member, PersistedRoom, SlotInfo } from "./hub";

// Implémentations PostgreSQL des dépendances du Portail.

export async function loadSlotInfo(db: Db, slotId: string): Promise<SlotInfo | null> {
  const [slot] = await db.select().from(schema.slots).where(eq(schema.slots.id, slotId)).limit(1);
  if (!slot) return null;
  const rows = await db
    .select({
      sessionId: schema.sessions.id,
      name: schema.sessions.candidateName,
      gems: schema.sessions.gems,
      status: schema.sessions.status,
      startedAt: schema.sessions.startedAt,
      seed: schema.sessions.seed,
    })
    .from(schema.sessions)
    .where(eq(schema.sessions.slotId, slotId))
    .orderBy(schema.sessions.createdAt, schema.sessions.id);
  if (rows.length === 0) return null;
  const members: Member[] = rows.map((r) => ({ sessionId: r.sessionId, name: r.name, gems: r.gems, status: r.status, startedAt: r.startedAt }));
  // Même graine pour les deux candidats d'un binôme ? Non : chaque session a la sienne.
  // L'énigme du Portail est commune : elle dérive de la graine de la 1re session.
  return { slotId, scenario: slot.scenario, seed: rows[0].seed, t0: slot.startedAt, members };
}

export async function loadSlotInfoOfSession(db: Db, sessionId: string): Promise<SlotInfo | null> {
  const [row] = await db.select({ slotId: schema.sessions.slotId }).from(schema.sessions).where(eq(schema.sessions.id, sessionId)).limit(1);
  return row ? loadSlotInfo(db, row.slotId) : null;
}

export function sessionFromCookie(header: string | undefined): string | null {
  const value = cookieValue(header, CANDIDATE_COOKIE);
  return decodeCandidateCookie(value)?.sessionId ?? null;
}

export async function loadRoom(db: Db, slotId: string): Promise<PersistedRoom | null> {
  const [r] = await db.select().from(schema.portalRooms).where(eq(schema.portalRooms.slotId, slotId)).limit(1);
  return r ? { code: r.code, epoch: r.epoch, driverSessionId: r.driverSessionId, openedAt: r.openedAt, solvedAt: r.solvedAt } : null;
}

export async function saveRoom(db: Db, slotId: string, patch: Partial<PersistedRoom>): Promise<void> {
  const values = {
    ...(patch.code !== undefined ? { code: patch.code } : {}),
    ...(patch.epoch !== undefined ? { epoch: patch.epoch } : {}),
    ...(patch.driverSessionId !== undefined ? { driverSessionId: patch.driverSessionId } : {}),
    ...(patch.openedAt !== undefined ? { openedAt: patch.openedAt } : {}),
    ...(patch.solvedAt !== undefined ? { solvedAt: patch.solvedAt } : {}),
    updatedAt: sql`now()`,
  };
  await db.insert(schema.portalRooms).values({ slotId, ...values }).onConflictDoUpdate({ target: schema.portalRooms.slotId, set: values });
}

export const journal = (db: Db) => (sessionId: string, actor: "candidat" | "systeme" | "recruteur", events: { type: string; payload?: Record<string, unknown> }[], at: Date) =>
  appendEvents(db, sessionId, actor, events, at).then(() => undefined);
