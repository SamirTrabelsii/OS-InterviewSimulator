import { describe, expect, it } from "vitest";
import { buildInstance } from "@/engine/content/instance";
import { scenarios } from "@content/index";
import { MalformedAnswerError } from "./errors";
import { gradeQuiz } from "./quiz";

describe.each(scenarios.map((s) => [s.meta.id, s] as const))("validateur quiz — %s", (_id, def) => {
  const stage = buildInstance(def, 4242n).stages.quiz;
  const questions = stage.public.questions;
  const right = Object.fromEntries(questions.map((q) => [q.id, stage.private.answers[q.id]]));
  const wrongChoice = (qid: string) => questions.find((q) => q.id === qid)!.choices.find((c) => c.id !== right[qid])!.id;

  it("toutes les bonnes réponses → total juste", () => {
    expect(gradeQuiz(stage, right)).toMatchObject({ correct: questions.length, total: questions.length });
  });

  it("des mauvaises réponses sont comptées, avec le détail pour le recruteur", () => {
    const [q1, q2] = questions;
    const grade = gradeQuiz(stage, { ...right, [q1.id]: wrongChoice(q1.id), [q2.id]: wrongChoice(q2.id) });
    expect(grade.correct).toBe(questions.length - 2);
    expect(grade.details[q1.id]).toEqual({ given: wrongChoice(q1.id), expected: right[q1.id], ok: false });
  });

  it("refuse une réponse mal formée", () => {
    const [q1] = questions;
    const missing = Object.fromEntries(Object.entries(right).filter(([k]) => k !== q1.id));
    expect(() => gradeQuiz(stage, missing)).toThrow(MalformedAnswerError);
    expect(() => gradeQuiz(stage, { ...right, [q1.id]: "c99" })).toThrow(MalformedAnswerError);
    expect(() => gradeQuiz(stage, { ...right, inventee: "c1" })).toThrow(MalformedAnswerError);
    expect(() => gradeQuiz(stage, "c1,c2")).toThrow(MalformedAnswerError);
    expect(() => gradeQuiz(stage, { ...right, [q1.id]: 3 })).toThrow(MalformedAnswerError);
  });
});
