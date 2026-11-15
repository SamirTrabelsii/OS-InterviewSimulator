import "server-only";
import { and, asc, inArray } from "drizzle-orm";
import { STAGE_EVENT_TYPES, spotOf, type MapSpot } from "@/engine/recruteur/live";
import type { ReplayEvent } from "@/engine/replay";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";

/**
 * Où se trouve chaque candidat sur la mini-carte (écran affiché). Ne lit que
 * les événements d'entrée et de sortie d'écran, pas tout le journal.
 */
export async function loadSpots(db: Db, members: ReadonlyArray<{ sessionId: string; status: string }>): Promise<Record<string, MapSpot | null>> {
  const ids = members.map((m) => m.sessionId);
  if (ids.length === 0) return {};
  const rows = await db
    .select({ sessionId: schema.events.sessionId, seq: schema.events.seq, ts: schema.events.ts, type: schema.events.type, payload: schema.events.payload })
    .from(schema.events)
    .where(and(inArray(schema.events.sessionId, ids), inArray(schema.events.type, [...STAGE_EVENT_TYPES])))
    .orderBy(asc(schema.events.ts), asc(schema.events.seq));
  const out: Record<string, MapSpot | null> = {};
  for (const m of members) {
    const evs: ReplayEvent[] = rows
      .filter((r) => r.sessionId === m.sessionId)
      .map((r) => ({ seq: r.seq, t: r.ts.getTime(), actor: "candidat", type: r.type, payload: (r.payload ?? {}) as Record<string, unknown> }));
    out[m.sessionId] = spotOf(evs, m.status);
  }
  return out;
}

