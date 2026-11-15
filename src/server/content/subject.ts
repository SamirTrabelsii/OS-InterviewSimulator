import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { scenarioInstanceSchema, type ScenarioInstance } from "@/engine/content/schemas";
import { toPublic } from "@/engine/content/instance";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";
import { buildFromContent, deepFreeze } from "./registry";

// Sujet figé d'une session.
//
// Le sujet d'un candidat dépend de sa graine ET du contenu de /content. Pour
// que modifier le contenu ne change ni ce qu'un candidat voit au rechargement,
// ni ce qui sert à corriger ses soumissions, ni ce que le recruteur relit, le
// sujet complet (partie publique et privée) est écrit en base au démarrage de
// la session (colonne sessions.subject) et relu de là ensuite.
//
// Sessions créées avant cette colonne (subject = null) : le sujet est généré
// depuis le contenu actuel à la première lecture, puis figé à son tour.

/** À incrémenter si la forme de ScenarioInstance change de façon incompatible. */
export const SUBJECT_VERSION = 1;

const storedSchema = z.object({ version: z.number().int(), instance: z.unknown() });

export type SubjectRef = { sessionId: string; scenarioId: string; seed: bigint };

const CACHE_SIZE = 16;
const cache = new Map<string, ScenarioInstance>();

function remember(sessionId: string, instance: ScenarioInstance): ScenarioInstance {
  cache.set(sessionId, instance);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return instance;
}

/** Vide la mémoire (tests). */
export function clearSubjectCache(): void {
  cache.clear();
}

function parseStored(sessionId: string, raw: unknown): ScenarioInstance {
  const stored = storedSchema.parse(raw);
  if (stored.version !== SUBJECT_VERSION) {
    throw new Error(`Sujet figé de la session ${sessionId} : version ${stored.version} non prise en charge`);
  }
  return deepFreeze(scenarioInstanceSchema.parse(stored.instance));
}

/**
 * Fige le sujet de la session s'il ne l'est pas encore, et le renvoie.
 * Sûr en cas d'appels simultanés : le premier écrit, les autres relisent.
 */
export async function freezeSubject(db: Db, ref: SubjectRef): Promise<ScenarioInstance> {
  const hit = cache.get(ref.sessionId);
  if (hit) return hit;

  const [row] = await db.select({ subject: schema.sessions.subject }).from(schema.sessions).where(eq(schema.sessions.id, ref.sessionId)).limit(1);
  if (!row) throw new Error(`Session introuvable : ${ref.sessionId}`);
  if (row.subject != null) return remember(ref.sessionId, parseStored(ref.sessionId, row.subject));

  const instance = deepFreeze(buildFromContent(ref.scenarioId, ref.seed));
  const written = await db
    .update(schema.sessions)
    .set({ subject: { version: SUBJECT_VERSION, instance } })
    .where(and(eq(schema.sessions.id, ref.sessionId), isNull(schema.sessions.subject)))
    .returning({ id: schema.sessions.id });
  if (written.length > 0) return remember(ref.sessionId, instance);

  // Une autre requête a figé le sujet entre-temps : c'est le sien qui fait foi.
  const [again] = await db.select({ subject: schema.sessions.subject }).from(schema.sessions).where(eq(schema.sessions.id, ref.sessionId)).limit(1);
  return remember(ref.sessionId, parseStored(ref.sessionId, again?.subject));
}

/** Instance complète (avec solutions) de la session. Usage serveur uniquement. Gelée. */
export function loadSessionInstance(db: Db, ref: SubjectRef): Promise<ScenarioInstance> {
  return freezeSubject(db, ref);
}

/** Ce qui peut être envoyé au navigateur du candidat. */
export async function loadSessionPublic(db: Db, ref: SubjectRef) {
  return toPublic(await freezeSubject(db, ref));
}

/** Sujet figé d'une session pour le recruteur, ou null si elle n'a pas de sujet (jamais lue). */
export async function loadStoredSubject(db: Db, sessionId: string): Promise<ScenarioInstance | null> {
  const [row] = await db.select({ subject: schema.sessions.subject }).from(schema.sessions).where(eq(schema.sessions.id, sessionId)).limit(1);
  return row?.subject == null ? null : parseStored(sessionId, row.subject);
}
