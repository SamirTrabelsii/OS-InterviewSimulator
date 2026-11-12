import { describe, expect, it } from "vitest";
import { canStart, canSubmit, deadlineFrom, linkIsOpen, phaseAt, portalOpenAt } from "./timeline";

const t0 = new Date("2026-12-01T09:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const ALL = ["quiz", "sql", "algo", "logique"];

describe("fenêtre du lien", () => {
  it("ouvert de −15 min à +2 h autour de l'heure prévue", () => {
    expect(linkIsOpen(t0, at(-16))).toBe(false);
    expect(linkIsOpen(t0, at(-15))).toBe(true);
    expect(linkIsOpen(t0, at(120))).toBe(true);
    expect(linkIsOpen(t0, at(121))).toBe(false);
  });
  it("on ne démarre pas avant l'heure prévue", () => {
    expect(canStart(t0, at(-1))).toBe(false);
    expect(canStart(t0, at(0))).toBe(true);
    expect(canStart(t0, at(121))).toBe(false);
  });
});

describe("ouverture du Portail", () => {
  it("s'ouvre dès que les deux candidats ont leurs 4 gemmes", () => {
    expect(portalOpenAt(t0, [ALL, ALL], at(20))).toEqual(at(20));
  });
  it("reste fermé si un seul des deux a fini avant T0+33", () => {
    expect(portalOpenAt(t0, [ALL, ["quiz"]], at(32))).toBeNull();
  });
  it("s'ouvre à T0+33 même s'il manque des gemmes", () => {
    expect(portalOpenAt(t0, [[], ["quiz"]], at(33))).toEqual(at(33));
  });
  it("en solo, dépend du seul candidat", () => {
    expect(portalOpenAt(t0, [ALL], at(10))).toEqual(at(10));
  });
});

describe("phases et chrono", () => {
  it("attente → gemmes → portail → terminé", () => {
    expect(phaseAt(null, [[]], at(0))).toBe("attente");
    expect(phaseAt(t0, [[]], at(5))).toBe("gemmes");
    expect(phaseAt(t0, [[]], at(33))).toBe("portail");
    expect(phaseAt(t0, [ALL], at(44))).toBe("portail");
    expect(phaseAt(t0, [ALL], at(45))).toBe("termine");
  });
  it("fin à T0 + 45 min ; soumission refusée après", () => {
    expect(deadlineFrom(t0)).toEqual(at(45));
    expect(canSubmit(t0, at(44.99))).toBe(true);
    expect(canSubmit(t0, at(45))).toBe(false);
    expect(canSubmit(null, at(1))).toBe(false);
  });
});
