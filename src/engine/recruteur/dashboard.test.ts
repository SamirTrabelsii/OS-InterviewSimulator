import { describe, expect, it } from "vitest";
import { candidateState, effectiveSlotStatus, formatRemaining, groupSlots, tally } from "./dashboard";

const now = new Date("2026-11-15T10:00:00Z");
const at = (min: number) => new Date(now.getTime() + min * 60_000);

describe("candidateState", () => {
  it("session terminée non notée par moi → à noter", () => {
    expect(candidateState({ status: "terminee", deadline: at(-5), evaluatedByMe: false }, now).kind).toBe("a_noter");
  });
  it("session terminée et notée par moi → noté", () => {
    expect(candidateState({ status: "terminee", deadline: at(-5), evaluatedByMe: true }, now).kind).toBe("note");
  });
  it("temps écoulé alors que le statut n'a pas encore basculé → à noter", () => {
    expect(candidateState({ status: "en_cours", deadline: at(-1), evaluatedByMe: false }, now).kind).toBe("a_noter");
  });
  it("en cours : temps restant", () => {
    expect(candidateState({ status: "en_cours", deadline: at(23), evaluatedByMe: false }, now)).toEqual({
      kind: "en_cours",
      remainingMs: 23 * 60_000,
    });
  });
  it("en cours sans échéance connue : pas de temps restant, jamais « à noter »", () => {
    expect(candidateState({ status: "en_cours", deadline: null, evaluatedByMe: false }, now)).toEqual({ kind: "en_cours", remainingMs: null });
  });
  it("en attente et retiré ne sont jamais « à noter »", () => {
    expect(candidateState({ status: "en_attente", deadline: null, evaluatedByMe: false }, now).kind).toBe("attente");
    expect(candidateState({ status: "expiree", deadline: null, evaluatedByMe: false }, now).kind).toBe("retire");
  });
});

describe("formatRemaining", () => {
  it("arrondit à la minute supérieure, sans secondes", () => {
    expect(formatRemaining(23 * 60_000)).toBe("23 min");
    expect(formatRemaining(22 * 60_000 + 1)).toBe("23 min");
    expect(formatRemaining(30_000)).toBe("moins d'1 min");
    expect(formatRemaining(0)).toBe("temps écoulé");
  });
});

describe("groupSlots / tally", () => {
  const slots = [
    { status: "termine", scheduledAt: at(-300), candidates: [{ status: "terminee", deadline: at(-250), evaluatedByMe: false }] },
    { status: "termine", scheduledAt: at(-100), candidates: [{ status: "terminee", deadline: at(-50), evaluatedByMe: true }] },
    { status: "en_cours", scheduledAt: at(-10), candidates: [{ status: "en_cours", deadline: at(35), evaluatedByMe: false }] },
    { status: "planifie", scheduledAt: at(600), candidates: [{ status: "en_attente", deadline: null, evaluatedByMe: false }] },
    { status: "planifie", scheduledAt: at(60), candidates: [{ status: "en_attente", deadline: null, evaluatedByMe: false }] },
  ];
  it("regroupe et ordonne", () => {
    const g = groupSlots(slots);
    expect(g.direct).toHaveLength(1);
    expect(g.venir.map((s) => s.scheduledAt)).toEqual([at(60), at(600)]);
    expect(g.passees.map((s) => s.scheduledAt)).toEqual([at(-100), at(-300)]);
  });
  it("compte", () => {
    expect(tally(slots, now)).toEqual({ enCours: 1, aNoter: 1, aVenir: 2 });
  });
});

describe("effectiveSlotStatus", () => {
  it("un créneau en cours sans candidat qui joue encore est terminé", () => {
    const over = { status: "en_cours", candidates: [{ status: "en_cours", deadline: at(-3) }] };
    expect(effectiveSlotStatus(over, now)).toBe("termine");
    const live = { status: "en_cours", candidates: [{ status: "en_cours", deadline: at(10) }] };
    expect(effectiveSlotStatus(live, now)).toBe("en_cours");
  });
  it("ne touche pas aux autres statuts", () => {
    expect(effectiveSlotStatus({ status: "planifie", candidates: [] }, now)).toBe("planifie");
    expect(effectiveSlotStatus({ status: "annule", candidates: [] }, now)).toBe("annule");
  });
});
