import { describe, expect, it } from "vitest";
import { DEFAULT_FOLLOWUP_DAYS, followUpDays } from "./followup";

describe("délai annoncé au candidat", () => {
  it("7 jours par défaut", () => {
    expect(followUpDays({})).toBe(7);
    expect(DEFAULT_FOLLOWUP_DAYS).toBe(7);
  });
  it("configurable par CANDIDATE_FOLLOWUP_DAYS (entier de 1 à 60)", () => {
    expect(followUpDays({ CANDIDATE_FOLLOWUP_DAYS: "3" })).toBe(3);
    expect(followUpDays({ CANDIDATE_FOLLOWUP_DAYS: "14" })).toBe(14);
  });
  it("valeur invalide : on garde 7", () => {
    for (const v of ["", "abc", "0", "-2", "2.5", "365"]) expect(followUpDays({ CANDIDATE_FOLLOWUP_DAYS: v })).toBe(7);
  });
});
