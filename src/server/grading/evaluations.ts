// Notation et replay côté recruteur. Rien de ce module ne doit être appelé
// depuis une route ou une page candidat (vérifié par evaluations.test.ts).
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { grille } from "@content/grille";
import { evaluate, type Resultat } from "@/engine/grille/adequation";
import type { Notes } from "@/engine/grille/types";
import type { ReplayEvent } from "@/engine/replay";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";

// ---------------------------------------------------------------- entrée

const noteEntry = z.strictObject({
  /** 1 à 4, ou null = « non observé ». */
  note: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.null()]),
  /** Instant du replay (ms depuis le début de la session) qui justifie la note. */
  moment: z.number().int().min(0).max(24 * 3600_000).nullable().default(null),
  why: z.string().trim().max(500).default(""),
});

const known = new Set(grille.competences.map((c) => c.id));

export const evaluationInput = z.strictObject({
  grid: z.record(z.string(), noteEntry).refine((g) => Object.keys(g).every((k) => known.has(k)), { message: "Compétence inconnue" }),
  comment: z.string().trim().max(4000).default(""),
});
export type EvaluationInput = z.input<typeof evaluationInput>;

export type EvaluationView = {
  grid: Record<string, { note: 1 | 2 | 3 | 4 | null; moment: number | null; why: string }>;
  comment: string;
  result: Resultat;
  updatedAt: Date;
};

export function notesOf(grid: EvaluationView["grid"]): Notes {
  return Object.fromEntries(Object.entries(grid).map(([k, v]) => [k, v.note]));
}

function toView(row: typeof schema.evaluations.$inferSelect): EvaluationView {
  // Relecture défensive : la colonne est un jsonb écrit par ce module.
  const parsed = evaluationInput.shape.grid.safeParse(row.grid);
  const grid = parsed.success ? parsed.data : {};
  return { grid, comment: row.comment ?? "", result: evaluate(grille, notesOf(grid)), updatedAt: row.updatedAt };
}

// ---------------------------------------------------------------- notation

/** La note d'un recruteur : seul son auteur la relit (chacun note seul). */
export async function loadMyEvaluation(db: Db, sessionId: string, recruiterEmail: string): Promise<EvaluationView | null> {
  const [row] = await db
    .select()
    .from(schema.evaluations)
    .where(and(eq(schema.evaluations.sessionId, sessionId), eq(schema.evaluations.recruiterEmail, recruiterEmail)))
    .limit(1);
  return row ? toView(row) : null;
}

/**
 * Sessions que CE recruteur a déjà notées (pour le badge « À noter » du
 * tableau de bord). Ne renvoie que des identifiants : ni note ni adéquation.
 */
export async function evaluatedSessionIds(db: Db, recruiterEmail: string, sessionIds: readonly string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const rows = await db
    .select({ id: schema.evaluations.sessionId })
    .from(schema.evaluations)
    .where(and(eq(schema.evaluations.recruiterEmail, recruiterEmail), inArray(schema.evaluations.sessionId, [...sessionIds])));
  return new Set(rows.map((r) => r.id));
}

/**
 * Enregistre (crée ou remplace) la notation du recruteur. L'adéquation est
 * TOUJOURS recalculée ici : ce que le navigateur affiche n'est qu'un aperçu.
 */
export async function saveEvaluation(db: Db, sessionId: string, recruiterEmail: string, raw: unknown): Promise<EvaluationView | null> {
  const input = evaluationInput.parse(raw);
  const [session] = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.id, sessionId)).limit(1);
  if (!session) return null;
  const result = evaluate(grille, notesOf(input.grid));
  const profileFit = Object.fromEntries(result.adequations.map((a) => [a.profil, a.pourcentage]));
  const values = { grid: input.grid, profileFit: { ...profileFit, nonRetenu: result.nonRetenu }, comment: input.comment, updatedAt: new Date() };
  const [row] = await db
    .insert(schema.evaluations)
    .values({ sessionId, recruiterEmail, ...values })
    .onConflictDoUpdate({ target: [schema.evaluations.sessionId, schema.evaluations.recruiterEmail], set: values })
    .returning();
  return toView(row);
}

// ---------------------------------------------------------------- replay

export type ReplayData = {
  sessionId: string;
  slotId: string;
  candidateName: string;
  scenario: string;
  mode: "solo" | "binome";
  status: string;
  gems: string[];
  /** Début de la session (ISO) : origine des temps `t` des événements. */
  startedAt: string | null;
  events: ReplayEvent[];
};

/** Événements d'une session, avec des temps relatifs au début de la session. */
export async function loadReplay(db: Db, sessionId: string): Promise<ReplayData | null> {
  const [row] = await db
    .select({ session: schema.sessions, scenario: schema.slots.scenario, mode: schema.slots.mode })
    .from(schema.sessions)
    .innerJoin(schema.slots, eq(schema.slots.id, schema.sessions.slotId))
    .where(eq(schema.sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  const rows = await db.select().from(schema.events).where(eq(schema.events.sessionId, sessionId)).orderBy(asc(schema.events.ts), asc(schema.events.seq));
  // Origine : début de la session ; à défaut (jamais démarrée), premier événement.
  const origin = row.session.startedAt?.getTime() ?? rows[0]?.ts.getTime() ?? 0;
  return {
    sessionId,
    slotId: row.session.slotId,
    candidateName: row.session.candidateName,
    scenario: row.scenario,
    mode: row.mode,
    status: row.session.status,
    gems: row.session.gems,
    startedAt: row.session.startedAt?.toISOString() ?? null,
    events: rows.map((e) => ({
      seq: e.seq,
      t: Math.max(0, e.ts.getTime() - origin),
      actor: e.actor,
      type: e.type,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    })),
  };
}
