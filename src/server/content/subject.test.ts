// Sujet figé : vraie base, vrai contenu. Le contenu est simulé « modifié »
// en changeant la graine en base (même effet : buildFromContent donnerait
// un autre sujet), ce que le sujet figé doit ignorer.
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

describe.runIf(Boolean(process.env.DATABASE_URL))("sujet figé d'une session", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { startSession } = await import("@/server/candidate/session");
  const { loadReplay } = await import("@/server/grading/evaluations");
  const { buildFromContent } = await import("./registry");
  const { clearSubjectCache, loadSessionInstance, loadSessionPublic, loadStoredSubject, SUBJECT_VERSION } = await import("./subject");

  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  const t0 = new Date("2026-12-01T09:00:00Z");
  let sessionId = "";
  let seed = 0n;

  beforeEach(async () => {
    clearSubjectCache();
    const input = createSlotInput.parse({ scenario: "retail", mode: "solo", scheduledAt: t0.toISOString(), candidates: ["Test Sujet"] });
    const { slotId, links } = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(slotId);
    sessionId = links[0].sessionId;
    seed = (await db().select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)))[0].seed;
  });

  const ref = () => ({ sessionId, scenarioId: "retail", seed });
  const stored = async () => (await db().select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)))[0].subject;

  it("n'est pas figé avant le démarrage, puis l'est au démarrage", async () => {
    expect(await stored()).toBeNull();
    await startSession(db(), sessionId, t0);
    expect(await stored()).toMatchObject({ version: SUBJECT_VERSION });
    expect(await loadStoredSubject(db(), sessionId)).toEqual(buildFromContent("retail", seed));
  });

  it("ignore un changement de contenu : le sujet reste celui du démarrage", async () => {
    await startSession(db(), sessionId, t0);
    const before = await loadSessionInstance(db(), ref());

    // « Le contenu change » : la même graine donnerait maintenant un autre sujet.
    const other = seed + 1n;
    expect(buildFromContent("retail", other)).not.toEqual(before);
    await db().update(schema.sessions).set({ seed: other }).where(eq(schema.sessions.id, sessionId));
    clearSubjectCache(); // comme après un redémarrage du serveur

    expect(await loadSessionInstance(db(), { ...ref(), seed: other })).toEqual(before);
    expect((await loadSessionPublic(db(), { ...ref(), seed: other })).stages.quiz).toEqual(before.stages.quiz.public);
  });

  it("complète à la première lecture une session sans sujet (ancienne session)", async () => {
    await startSession(db(), sessionId, t0);
    await db().update(schema.sessions).set({ subject: null }).where(eq(schema.sessions.id, sessionId));
    clearSubjectCache();

    const instance = await loadSessionInstance(db(), ref());
    expect(instance).toEqual(buildFromContent("retail", seed));
    expect(await stored()).not.toBeNull();
  });

  it("deux lectures simultanées d'une ancienne session aboutissent au même sujet", async () => {
    await db().update(schema.sessions).set({ subject: null }).where(eq(schema.sessions.id, sessionId));
    const [a, b] = await Promise.all([loadSessionInstance(db(), ref()), loadSessionInstance(db(), ref())]);
    expect(a).toEqual(b);
  });

  it("refuse une version de sujet inconnue au lieu de le régénérer en silence", async () => {
    await db().update(schema.sessions).set({ subject: { version: 999, instance: {} } }).where(eq(schema.sessions.id, sessionId));
    await expect(loadSessionInstance(db(), ref())).rejects.toThrow(/version 999/);
  });

  it("le replay expose les questions du sujet figé (null sans sujet)", async () => {
    expect((await loadReplay(db(), sessionId))!.quiz).toBeNull();
    await startSession(db(), sessionId, t0);
    const quiz = (await loadReplay(db(), sessionId))!.quiz!;
    const expected = buildFromContent("retail", seed).stages.quiz.public.questions;
    expect(quiz.map((q) => q.id)).toEqual(expected.map((q) => q.id));
    expect(JSON.stringify(quiz)).not.toMatch(/CANARI|answers/);
  });
});
