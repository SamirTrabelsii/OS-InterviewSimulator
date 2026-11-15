import { and, eq, ne, sql } from "drizzle-orm";
import { canStart, canSubmit, deadlineFrom, isOnline, linkIsOpen, phaseAt, portalOpenAt, type Phase } from "@/engine/timeline";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/slots/service";
import { hashToken } from "@/server/tokens";
import { appendEvents } from "./events";

/** Délai de grâce pour les derniers événements client après la fin (réseau lent). */
export const EVENTS_GRACE_MS = 2 * 60_000;

// ---------------------------------------------------------------- ouverture du lien

export type OpenLinkResult =
  | { ok: true; sessionId: string; deviceId: string; newDevice: boolean }
  | { ok: false; reason: "invalide" | "pas-encore" | "expire" | "termine" };

/**
 * Valide un lien `/s/<jeton>`. Journalise chaque ouverture ; une ouverture
 * depuis un nouvel appareil alors que la session a déjà démarré est
 * signalée (visible au replay).
 */
export async function openLink(
  db: Db,
  token: string,
  now: Date,
  device: { deviceId: string; userAgent: string },
): Promise<OpenLinkResult> {
  const [row] = await db
    .select({ session: schema.sessions, scheduledAt: schema.slots.scheduledAt })
    .from(schema.sessions)
    .innerJoin(schema.slots, eq(schema.slots.id, schema.sessions.slotId))
    .where(eq(schema.sessions.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return { ok: false, reason: "invalide" };
  const { session, scheduledAt } = row;
  if (session.status === "terminee" || session.status === "expiree") return { ok: false, reason: "termine" };
  if (session.deadline && now >= session.deadline) return { ok: false, reason: "termine" };
  if (!linkIsOpen(scheduledAt, now)) {
    return { ok: false, reason: now < scheduledAt ? "pas-encore" : "expire" };
  }

  const [{ known }] = await db
    .select({ known: sql<number>`count(*)::int` })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.sessionId, session.id),
        eq(schema.events.type, "access.open"),
        sql`${schema.events.payload}->>'deviceId' = ${device.deviceId}`,
      ),
    );
  const [{ others }] = await db
    .select({ others: sql<number>`count(*)::int` })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.sessionId, session.id),
        eq(schema.events.type, "access.open"),
        sql`${schema.events.payload}->>'deviceId' <> ${device.deviceId}`,
      ),
    );
  const newDevice = known === 0 && others > 0;

  await appendEvents(db, session.id, "systeme", [
    {
      type: "access.open",
      payload: {
        deviceId: device.deviceId,
        userAgent: device.userAgent.slice(0, 300),
        newDevice,
        afterStart: session.startedAt !== null,
      },
    },
  ]);
  return { ok: true, sessionId: session.id, deviceId: device.deviceId, newDevice };
}

// ---------------------------------------------------------------- état vu par le candidat

export type CandidateView = {
  sessionId: string;
  candidateName: string;
  scenarioId: string;
  seed: bigint;
  mode: "solo" | "binome";
  scheduledAt: Date;
  t0: Date | null;
  deadline: Date | null;
  gems: string[];
  phase: Phase;
  canStartNow: boolean;
  /** Retiré du binôme par le recruteur (repli solo) : sa session est close. */
  retired: boolean;
  /** Le Portail du créneau a été franchi (déjà montré au candidat dans l'écran du Portail). */
  portalSolved: boolean;
  /** T0 du créneau s'il a déjà démarré (le binôme a cliqué), même si ce candidat n'a pas encore commencé. */
  slotT0: Date | null;
  /** Lien de l'appel du binôme (saisi par le recruteur), sinon null. */
  callUrl: string | null;
  /** Binôme actif : prénom, gemmes obtenues, connexion récente. Null en solo. */
  partner: { name: string; gems: number; online: boolean; started: boolean } | null;
};

export async function loadCandidateView(db: Db, sessionId: string, now: Date): Promise<CandidateView | null> {
  const [row] = await db
    .select({ session: schema.sessions, slot: schema.slots })
    .from(schema.sessions)
    .innerJoin(schema.slots, eq(schema.slots.id, schema.sessions.slotId))
    .where(eq(schema.sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  const { session, slot } = row;

  const partners = await db
    .select({
      gems: schema.sessions.gems,
      name: schema.sessions.candidateName,
      lastSeenAt: schema.sessions.lastSeenAt,
      startedAt: schema.sessions.startedAt,
    })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.slotId, slot.id),
        ne(schema.sessions.id, session.id),
        // Un partenaire retiré (repli solo) ne retient plus l'ouverture du Portail.
        ne(schema.sessions.status, "expiree"),
      ),
    );
  const t0 = session.startedAt ? slot.startedAt : null;

  // Clôture paresseuse : la première lecture après la fin marque la session terminée.
  if (session.status === "en_cours" && session.deadline && now >= session.deadline) {
    const [closed] = await db
      .update(schema.sessions)
      .set({ status: "terminee" })
      .where(and(eq(schema.sessions.id, session.id), eq(schema.sessions.status, "en_cours")))
      .returning({ id: schema.sessions.id });
    if (closed) {
      await appendEvents(db, session.id, "systeme", [{ type: "session.end", payload: { reason: "temps-ecoule", gems: session.gems } }]);
      session.status = "terminee";
    }
  }

  const [room] = await db
    .select({ solvedAt: schema.portalRooms.solvedAt })
    .from(schema.portalRooms)
    .where(eq(schema.portalRooms.slotId, slot.id))
    .limit(1);

  return {
    sessionId: session.id,
    candidateName: session.candidateName,
    scenarioId: slot.scenario,
    seed: session.seed,
    mode: slot.mode,
    scheduledAt: slot.scheduledAt,
    t0,
    deadline: session.deadline,
    gems: session.gems,
    phase: session.status === "expiree" ? "termine" : phaseAt(t0, [session.gems, ...partners.map((p) => p.gems)], now),
    retired: session.status === "expiree",
    portalSolved: room?.solvedAt != null,
    slotT0: slot.startedAt,
    callUrl: slot.mode === "binome" ? slot.callUrl : null,
    partner:
      slot.mode === "binome" && partners[0]
        ? {
            name: partners[0].name.split(/\s+/)[0] ?? partners[0].name,
            gems: partners[0].gems.length,
            online: isOnline(partners[0].lastSeenAt, now),
            started: partners[0].startedAt !== null,
          }
        : null,
    canStartNow: !session.startedAt && canStart(slot.scheduledAt, now) && (!slot.startedAt || now < deadlineFrom(slot.startedAt)),
  };
}

/** Instant d'ouverture du Portail pour cette session (null tant qu'il est fermé). */
export function portalOpenFor(view: CandidateView, partnerGems: string[][], now: Date): Date | null {
  return view.t0 ? portalOpenAt(view.t0, [view.gems, ...partnerGems], now) : null;
}

// ---------------------------------------------------------------- démarrage

export class SessionError extends Error {
  constructor(
    public readonly code: "introuvable" | "pas-encore" | "termine" | "hors-delai",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Démarre la session d'un candidat. T0 est commun au créneau : fixé par le
 * premier « Commencer », réutilisé par le second candidat d'un binôme.
 * Idempotent : un second appel ne change rien.
 */
export async function startSession(db: Db, sessionId: string, now: Date): Promise<{ t0: Date; deadline: Date }> {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ session: schema.sessions, slot: schema.slots })
      .from(schema.sessions)
      .innerJoin(schema.slots, eq(schema.slots.id, schema.sessions.slotId))
      .where(eq(schema.sessions.id, sessionId))
      .for("update")
      .limit(1);
    if (!row) throw new SessionError("introuvable", "Session introuvable");
    const { session, slot } = row;

    if (session.startedAt && session.deadline) {
      return { t0: slot.startedAt ?? session.startedAt, deadline: session.deadline, started: false };
    }
    if (!canStart(slot.scheduledAt, now)) {
      throw new SessionError(now < slot.scheduledAt ? "pas-encore" : "hors-delai", "Démarrage impossible maintenant");
    }
    const t0 = slot.startedAt ?? now;
    const deadline = deadlineFrom(t0);
    if (now >= deadline) throw new SessionError("termine", "La session du créneau est déjà terminée");

    if (!slot.startedAt) {
      await tx.update(schema.slots).set({ startedAt: t0, status: "en_cours" }).where(eq(schema.slots.id, slot.id));
    }
    await tx
      .update(schema.sessions)
      .set({ startedAt: now, deadline, status: "en_cours" })
      .where(eq(schema.sessions.id, sessionId));
    return { t0, deadline, started: true };
  });

  if (result.started) {
    await appendEvents(db, sessionId, "systeme", [
      {
        type: "session.start",
        // Le candidat a vu l'information sur l'enregistrement avant de cliquer.
        payload: { t0: result.t0.toISOString(), deadline: result.deadline.toISOString(), notice: "replay-conserve-6-mois" },
      },
    ]);
  }
  return { t0: result.t0, deadline: result.deadline };
}

/** Vérifie qu'une soumission est dans le temps imparti (chrono serveur). */
export function assertCanSubmit(view: Pick<CandidateView, "t0" | "deadline">, now: Date): void {
  if (!view.t0 || !view.deadline) throw new SessionError("pas-encore", "La session n'a pas commencé");
  if (!canSubmit(view.t0, now) || now >= view.deadline) throw new SessionError("termine", "Le temps est écoulé");
}

/** Les événements client sont acceptés jusqu'à la fin + un court délai de grâce. */
export function acceptsClientEvents(view: Pick<CandidateView, "deadline" | "t0">, now: Date): boolean {
  if (!view.t0 || !view.deadline) return true; // écran d'accueil : focus, etc.
  return now.getTime() < view.deadline.getTime() + EVENTS_GRACE_MS;
}
