// Déroulé d'une session (docs/ARCHITECTURE.md § 3.7). Fonctions pures :
// l'heure est toujours passée en paramètre, jamais lue ici.

export const GEM_IDS = ["quiz", "sql", "algo", "logique"] as const;
export type GemId = (typeof GEM_IDS)[number];

const MIN = 60_000;
export const SESSION_MS = 45 * MIN;
/** Le Portail s'ouvre au plus tard à T0 + 33 min, même s'il manque des gemmes. */
export const PORTAL_LATEST_MS = 33 * MIN;
/** Fenêtre de validité d'un lien candidat autour de l'heure prévue. */
export const LINK_OPENS_BEFORE_MS = 15 * MIN;
export const LINK_CLOSES_AFTER_MS = 2 * 60 * MIN;

export const isGemId = (v: string): v is GemId => (GEM_IDS as readonly string[]).includes(v);

export function deadlineFrom(t0: Date): Date {
  return new Date(t0.getTime() + SESSION_MS);
}

export function linkIsOpen(scheduledAt: Date, now: Date): boolean {
  const t = now.getTime();
  return t >= scheduledAt.getTime() - LINK_OPENS_BEFORE_MS && t <= scheduledAt.getTime() + LINK_CLOSES_AFTER_MS;
}

/** On peut démarrer à partir de l'heure prévue (pas avant : le binôme partage T0). */
export function canStart(scheduledAt: Date, now: Date): boolean {
  return now.getTime() >= scheduledAt.getTime() && linkIsOpen(scheduledAt, now);
}

export function hasAllGems(gems: readonly string[]): boolean {
  return GEM_IDS.every((g) => gems.includes(g));
}

/**
 * Le Portail s'ouvre dès que TOUS les candidats du créneau ont leurs 4
 * gemmes, au plus tard à T0 + 33 min. Renvoie l'instant d'ouverture s'il
 * est atteint, sinon null.
 */
export function portalOpenAt(t0: Date, gemsByCandidate: readonly (readonly string[])[], now: Date): Date | null {
  const latest = new Date(t0.getTime() + PORTAL_LATEST_MS);
  if (now.getTime() >= latest.getTime()) return latest;
  if (gemsByCandidate.length > 0 && gemsByCandidate.every(hasAllGems)) return now;
  return null;
}

export type Phase = "attente" | "gemmes" | "portail" | "termine";

export function phaseAt(t0: Date | null, gemsByCandidate: readonly (readonly string[])[], now: Date): Phase {
  if (!t0) return "attente";
  if (now.getTime() >= deadlineFrom(t0).getTime()) return "termine";
  return portalOpenAt(t0, gemsByCandidate, now) ? "portail" : "gemmes";
}

/** Une soumission n'est acceptée qu'entre T0 et la fin (le chrono serveur fait foi). */
export function canSubmit(t0: Date | null, now: Date): boolean {
  return t0 !== null && now.getTime() >= t0.getTime() && now.getTime() < deadlineFrom(t0).getTime();
}
