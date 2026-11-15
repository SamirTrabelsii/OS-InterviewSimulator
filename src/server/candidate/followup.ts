/** Délai annoncé au candidat pour le retour du recruteur (jours), configurable : CANDIDATE_FOLLOWUP_DAYS. */
export const DEFAULT_FOLLOWUP_DAYS = 7;

export function followUpDays(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.CANDIDATE_FOLLOWUP_DAYS);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : DEFAULT_FOLLOWUP_DAYS;
}
