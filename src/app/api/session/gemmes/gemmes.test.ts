// Tests d'intégration des routes de gemmes : vraie base, vrai contenu.
// Seul le « candidat courant » (cookie + heure) est simulé.
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const candidateMock = vi.fn();
vi.mock("@/server/candidate/current", () => ({ currentCandidate: () => candidateMock() }));

describe.runIf(Boolean(process.env.DATABASE_URL))("routes des gemmes Quiz et Logique", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { startSession, loadCandidateView } = await import("@/server/candidate/session");
  const { loadInstance, allCanaries } = await import("@/server/content/registry");
  const quizRoute = await import("./quiz/route");
  const logiqueRoute = await import("./logique/route");

  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  const t0 = new Date("2026-12-01T09:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);

  let sessionId = "";
  let clock = at(1);

  /** Le candidat « connecté » est la session de test, vue à l'heure `clock`. */
  beforeEach(async () => {
    const input = createSlotInput.parse({ scenario: "retail", mode: "solo", scheduledAt: t0.toISOString(), candidates: ["Test Gemmes"] });
    const { slotId, links } = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(slotId);
    sessionId = links[0].sessionId;
    await startSession(db(), sessionId, at(0));
    clock = at(1);
    candidateMock.mockImplementation(async () => {
      const view = await loadCandidateView(db(), sessionId, clock);
      return { view, deviceId: "d", now: clock };
    });
  });

  const call = async (route: { POST: (r: Request) => Promise<Response> }, body: unknown) => {
    const res = await route.POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  };
  const instance = () =>
    db()
      .select({ seed: schema.sessions.seed })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .then(([r]) => loadInstance("retail", r.seed));
  const gems = async () => (await db().select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)))[0].gems;
  const events = async () =>
    db().select().from(schema.events).where(eq(schema.events.sessionId, sessionId)).orderBy(asc(schema.events.seq));

  /** Rien de ce qui suit ne doit atteindre le navigateur. */
  const assertNoLeak = (text: string, secrets: string[]) => {
    for (const c of allCanaries()) expect(text).not.toContain(c);
    for (const s of secrets) expect(text).not.toContain(s);
    expect(text).not.toMatch(/correct|expected|total|details|answer"/);
  };

  describe("quiz", () => {
    it("même réponse « gemme acquise » que les réponses soient justes ou fausses, sans correction", async () => {
      const quiz = (await instance()).stages.quiz;
      const wrong = Object.fromEntries(
        quiz.public.questions.map((q) => [q.id, q.choices.find((c) => c.id !== quiz.private.answers[q.id])!.id]),
      );
      const res = await call(quizRoute, { answers: wrong });
      expect(res).toMatchObject({ status: 200, body: { gem: true } });
      assertNoLeak(res.text, Object.values(quiz.private.answers).map((a) => `"${a}"`));
      expect(await gems()).toContain("quiz");

      const log = await events();
      const result = log.find((e) => e.type === "quiz.result")!;
      expect(result.actor).toBe("systeme");
      expect(result.payload).toMatchObject({ correct: 0, total: quiz.public.questions.length });
      // Ordre lisible au replay : soumission → correction → gemme
      const order = log.map((e) => e.type).filter((t) => ["quiz.submit", "quiz.result", "gem.obtained"].includes(t));
      expect(order).toEqual(["quiz.submit", "quiz.result", "gem.obtained"]);
    });

    it("une seule tentative : une seconde soumission ne recorrige pas", async () => {
      const quiz = (await instance()).stages.quiz;
      await call(quizRoute, { answers: quiz.private.answers });
      await call(quizRoute, { answers: quiz.private.answers });
      expect((await events()).filter((e) => e.type === "quiz.result")).toHaveLength(1);
    });

    it("une réponse mal formée est refusée et ne donne pas la gemme", async () => {
      const res = await call(quizRoute, { answers: { inventee: "c1" } });
      expect(res.status).toBe(400);
      expect(await gems()).not.toContain("quiz");
    });

    it("refusée après la fin (chrono serveur)", async () => {
      const quiz = (await instance()).stages.quiz;
      clock = at(45);
      const res = await call(quizRoute, { answers: quiz.private.answers });
      expect(res.status).toBe(409);
      expect(await gems()).not.toContain("quiz");
    });
  });

  describe("logique", () => {
    it("mauvaise réponse → refus sans indice ; essai immédiat → 429 ; bonne réponse après le délai → gemme", async () => {
      const { answer } = (await instance()).stages.logique.private;
      const wrong = answer === "0123" ? "3210" : "0123";

      const r1 = await call(logiqueRoute, { answer: wrong });
      expect(r1).toMatchObject({ status: 200, body: { ok: false } });
      assertNoLeak(r1.text, [answer]);

      clock = at(1.05); // 3 s plus tard
      expect((await call(logiqueRoute, { answer })).status).toBe(429);

      clock = at(1.2); // 12 s plus tard
      const r3 = await call(logiqueRoute, { answer });
      expect(r3).toMatchObject({ status: 200, body: { ok: true, gem: true } });
      assertNoLeak(r3.text, [answer]);
      expect(await gems()).toContain("logique");

      const attempts = (await events()).filter((e) => e.type === "logique.attempt");
      expect(attempts.map((e) => e.payload)).toEqual([
        { answer: wrong, ok: false },
        { answer, ok: true },
      ]);
    });

    it("une réponse mal formée est refusée et ne compte pas comme essai", async () => {
      const res = await call(logiqueRoute, { answer: "12a" });
      expect(res.status).toBe(400);
      expect((await events()).some((e) => e.type === "logique.attempt")).toBe(false);
    });

    it("401 sans session candidat", async () => {
      candidateMock.mockResolvedValueOnce(null);
      expect((await call(logiqueRoute, { answer: "1234" })).status).toBe(401);
    });
  });
});
