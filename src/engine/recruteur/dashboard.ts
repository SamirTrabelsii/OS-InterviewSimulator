// Tableau de bord recruteur : états et regroupements. Fonctions pures,
// l'heure est toujours passée en paramètre.

export type CandidateInput = {
  status: string; // en_attente | en_cours | terminee | expiree
  deadline: Date | null;
  /** Ce recruteur a déjà enregistré une notation pour cette session. */
  evaluatedByMe: boolean;
};

export type CandidateState =
  | { kind: "attente" }
  | { kind: "en_cours"; remainingMs: number | null }
  | { kind: "a_noter" }
  | { kind: "note" }
  | { kind: "retire" };

/**
 * « À noter » : session terminée (ou dont le temps est écoulé) et pas encore
 * évaluée PAR CE RECRUTEUR. Chacun note seul : la notation d'un collègue
 * ne retire pas le badge.
 */
export function candidateState(c: CandidateInput, now: Date): CandidateState {
  if (c.status === "expiree") return { kind: "retire" };
  if (c.status === "en_attente") return { kind: "attente" };
  const over = c.status === "terminee" || (c.deadline !== null && c.deadline.getTime() <= now.getTime());
  if (over) return c.evaluatedByMe ? { kind: "note" } : { kind: "a_noter" };
  return { kind: "en_cours", remainingMs: c.deadline ? Math.max(0, c.deadline.getTime() - now.getTime()) : null };
}

/** « 23 min », « moins d'1 min ». Jamais de secondes : rien ne doit défiler. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "temps écoulé";
  const min = Math.ceil(ms / 60_000);
  if (min <= 1) return "moins d'1 min";
  return `${min} min`;
}

/**
 * Un créneau « en cours » dont plus aucun candidat n'est en train de jouer
 * (temps écoulé, statut pas encore mis à jour) est affiché comme terminé.
 */
export function effectiveSlotStatus(
  slot: { status: string; candidates: ReadonlyArray<Pick<CandidateInput, "status" | "deadline">> },
  now: Date,
): string {
  if (slot.status !== "en_cours") return slot.status;
  const playing = slot.candidates.some((c) => candidateState({ ...c, evaluatedByMe: false }, now).kind === "en_cours");
  return playing ? "en_cours" : "termine";
}

export type SlotGroupKey = "direct" | "venir" | "passees";

/** En direct d'abord, puis à venir (le plus proche en premier), puis passées (le plus récent d'abord). */
export function groupSlots<T extends { status: string; scheduledAt: Date }>(slots: readonly T[]): Record<SlotGroupKey, T[]> {
  const out: Record<SlotGroupKey, T[]> = { direct: [], venir: [], passees: [] };
  for (const s of slots) {
    if (s.status === "en_cours") out.direct.push(s);
    else if (s.status === "planifie") out.venir.push(s);
    else out.passees.push(s);
  }
  out.venir.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  out.passees.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  return out;
}

export type Tally = { enCours: number; aNoter: number; aVenir: number };

export function tally(
  slots: ReadonlyArray<{ status: string; candidates: ReadonlyArray<CandidateInput> }>,
  now: Date,
): Tally {
  let enCours = 0;
  let aNoter = 0;
  let aVenir = 0;
  for (const s of slots) {
    if (s.status === "planifie") aVenir++;
    for (const c of s.candidates) {
      const st = candidateState(c, now);
      if (st.kind === "en_cours") enCours++;
      if (st.kind === "a_noter") aNoter++;
    }
  }
  return { enCours, aNoter, aVenir };
}
