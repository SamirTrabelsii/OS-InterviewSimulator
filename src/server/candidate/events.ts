import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";

type Actor = (typeof schema.eventActor.enumValues)[number];
export type NewEvent = { type: string; payload?: Record<string, unknown> };

/**
 * Ajoute des événements au journal d'une session. Le numéro `seq` est
 * attribué par le serveur sous verrou (ligne de la session), donc sans
 * trou ni doublon même si plusieurs onglets écrivent en même temps.
 */
export async function appendEvents(db: Db, sessionId: string, actor: Actor, events: NewEvent[]): Promise<number[]> {
  if (events.length === 0) return [];
  return db.transaction(async (tx) => {
    await tx.execute(sql`select 1 from ${schema.sessions} where ${schema.sessions.id} = ${sessionId} for update`);
    const [{ max }] = await tx
      .select({ max: sql<number>`coalesce(max(${schema.events.seq}), 0)::int` })
      .from(schema.events)
      .where(eq(schema.events.sessionId, sessionId));
    const rows = events.map((e, i) => ({ sessionId, seq: max + i + 1, actor, type: e.type, payload: e.payload ?? {} }));
    await tx.insert(schema.events).values(rows);
    return rows.map((r) => r.seq);
  });
}

// ---------------------------------------------------------------- événements envoyés par le navigateur

/**
 * Types que le navigateur a le droit d'écrire. Les événements qui font foi
 * (démarrage, soumissions, résultats, gemmes) sont écrits par le serveur.
 */
export const CLIENT_EVENT_TYPES = [
  "stage.enter",
  "stage.leave",
  "focus.lost",
  "focus.gained",
  "code.snapshot",
  "client.error",
] as const;

const MAX_PAYLOAD_BYTES = 16 * 1024;

export const clientEventBatch = z
  .array(
    z.strictObject({
      type: z.enum(CLIENT_EVENT_TYPES),
      clientTs: z.number().int().positive(),
      payload: z.record(z.string(), z.json()).default({}),
    }),
  )
  .min(1)
  .max(50)
  .refine((batch) => batch.every((e) => JSON.stringify(e.payload).length <= MAX_PAYLOAD_BYTES), {
    message: "Événement trop volumineux",
  });

export type ClientEventBatch = z.infer<typeof clientEventBatch>;
