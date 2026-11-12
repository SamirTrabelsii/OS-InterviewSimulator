import { desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { z } from "zod";
import * as schema from "@/server/db/schema";
import { newCandidateToken, newSeed } from "@/server/tokens";

export type Db = NodePgDatabase<typeof schema>;

export const createSlotInput = z
  .object({
    scenario: z.string({ error: "Scénario requis." }).min(1, "Scénario requis."),
    mode: z.enum(["solo", "binome"], { error: "Format invalide." }),
    scheduledAt: z
      .string({ error: "Date et heure requises." })
      .min(1, "Date et heure requises.")
      .transform((s) => new Date(s))
      .refine((d) => !Number.isNaN(d.getTime()), "Date et heure invalides."),
    candidates: z
      .array(z.string().trim().min(1, "Nom du candidat requis.").max(120, "Nom trop long."))
      .min(1, "Nom du candidat requis.")
      .max(2),
  })
  .refine((v) => v.candidates.length === (v.mode === "solo" ? 1 : 2), {
    message: "Un créneau solo a 1 candidat, un binôme en a 2.",
    path: ["candidates"],
  });

export type CreateSlotInput = z.output<typeof createSlotInput>;

export type CandidateLink = { sessionId: string; candidateName: string; token: string };

/**
 * Crée un créneau et ses sessions candidat. Les jetons en clair ne sont
 * renvoyés qu'ici, une seule fois : la base ne garde que leur hash.
 */
export async function createSlot(
  db: Db,
  input: CreateSlotInput,
  recruiterEmail: string,
  knownScenarios: string[],
): Promise<{ slotId: string; links: CandidateLink[] }> {
  if (!knownScenarios.includes(input.scenario)) throw new Error(`Scénario inconnu : ${input.scenario}`);

  return db.transaction(async (tx) => {
    const [slot] = await tx
      .insert(schema.slots)
      .values({ scenario: input.scenario, mode: input.mode, scheduledAt: input.scheduledAt, createdBy: recruiterEmail })
      .returning({ id: schema.slots.id });

    const links: CandidateLink[] = [];
    for (const candidateName of input.candidates) {
      const { token, hash } = newCandidateToken();
      const [s] = await tx
        .insert(schema.sessions)
        .values({ slotId: slot.id, candidateName, tokenHash: hash, seed: newSeed() })
        .returning({ id: schema.sessions.id });
      links.push({ sessionId: s.id, candidateName, token });
    }
    return { slotId: slot.id, links };
  });
}

/** Nouveau lien pour un candidat : l'ancien cesse immédiatement de fonctionner. */
export async function regenerateLink(db: Db, sessionId: string): Promise<CandidateLink> {
  const { token, hash } = newCandidateToken();
  const [s] = await db
    .update(schema.sessions)
    .set({ tokenHash: hash })
    .where(eq(schema.sessions.id, sessionId))
    .returning({ id: schema.sessions.id, candidateName: schema.sessions.candidateName });
  if (!s) throw new Error("Session introuvable");
  return { sessionId: s.id, candidateName: s.candidateName, token };
}

export type SlotSummary = {
  id: string;
  scenario: string;
  mode: "solo" | "binome";
  status: string;
  scheduledAt: Date;
  createdBy: string;
  candidates: { sessionId: string; name: string; status: string; gems: string[] }[];
};

/** Liste pour le tableau de bord. Ne contient ni jeton, ni hash, ni graine. */
export async function listSlots(db: Db, limit = 50): Promise<SlotSummary[]> {
  const slots = await db.select().from(schema.slots).orderBy(desc(schema.slots.scheduledAt)).limit(limit);
  if (slots.length === 0) return [];
  const sessions = await db
    .select({
      id: schema.sessions.id,
      slotId: schema.sessions.slotId,
      name: schema.sessions.candidateName,
      status: schema.sessions.status,
      gems: schema.sessions.gems,
    })
    .from(schema.sessions)
    .where(inArray(schema.sessions.slotId, slots.map((s) => s.id)))
    .orderBy(schema.sessions.createdAt);

  return slots.map((s) => ({
    id: s.id,
    scenario: s.scenario,
    mode: s.mode,
    status: s.status,
    scheduledAt: s.scheduledAt,
    createdBy: s.createdBy,
    candidates: sessions
      .filter((x) => x.slotId === s.id)
      .map((x) => ({ sessionId: x.id, name: x.name, status: x.status, gems: x.gems })),
  }));
}

export function candidateUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/s/${token}`;
}
