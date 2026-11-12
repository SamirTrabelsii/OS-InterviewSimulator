import { describe, expect, it } from "vitest";
import { buildInstance } from "@/engine/content/instance";
import { scenarios } from "@content/index";
import { MalformedAnswerError } from "./errors";
import { checkLogique } from "./logique";

describe.each(scenarios.map((s) => [s.meta.id, s] as const))("validateur logique — %s", (_id, def) => {
  const stage = buildInstance(def, 4242n).stages.logique;
  const answer = stage.private.answer;
  const wrong = answer === "0123" ? "3210" : "0123";

  it("bonne réponse → ok (espaces tolérés)", () => {
    expect(checkLogique(stage, answer)).toEqual({ ok: true, answer });
    expect(checkLogique(stage, ` ${answer.slice(0, 2)} ${answer.slice(2)} `).ok).toBe(true);
  });

  it("mauvaise réponse bien formée → pas ok", () => {
    expect(checkLogique(stage, wrong)).toEqual({ ok: false, answer: wrong });
  });

  it("refuse une réponse mal formée sans la compter", () => {
    for (const bad of ["", "12", "12345", "12a4", null, 1234, { code: answer }]) {
      expect(() => checkLogique(stage, bad)).toThrow(MalformedAnswerError);
    }
  });
});
