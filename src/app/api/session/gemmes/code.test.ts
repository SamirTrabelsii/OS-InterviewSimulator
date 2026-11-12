// Tests d'intégration des routes des gemmes SQL et Algo : vraie base,
// vrai contenu, vrai bac à sable. Seul le « candidat courant » (cookie +
// heure) est simulé. Projet Vitest « sandbox » (processus Pyodide).
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

const candidateMock = vi.fn();
vi.mock("@/server/candidate/current", () => ({ currentCandidate: () => candidateMock() }));

describe.runIf(Boolean(process.env.DATABASE_URL))("routes des gemmes SQL et Algo", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { startSession, loadCandidateView } = await import("@/server/candidate/session");
  const { loadInstance, allCanaries } = await import("@/server/content/registry");
  const { getSandbox } = await import("@/server/sandbox/pool");
  const sqlRoute = await import("./sql/route");

  getSandbox().prewarm();
  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
    getSandbox().close();
  });

  const t0 = new Date("2026-12-01T09:00:00Z");
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);

  let sessionId = "";
  let clock = at(1);

  beforeEach(async () => {
    const input = createSlotInput.parse({ scenario: "retail", mode: "solo", scheduledAt: t0.toISOString(), candidates: ["Test Code"] });
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

  /** La réponse au candidat ne contient que des clés autorisées, sans aucun canari. */
  const assertOnlyScore = (text: string, body: Record<string, unknown>) => {
    for (const c of allCanaries()) expect(text).not.toContain(c);
    expect(Object.keys(body).every((k) => ["ok", "gem", "passed", "total", "error", "retryAfterMs"].includes(k))).toBe(true);
  };

  describe("SQL", () => {
    const strip = (sql: string) => sql.replace(/^--.*\n/, "").trim();

    it("requête fausse → X / 2 sans gemme ; essai trop rapide → 429 ; requête juste → gemme", async () => {
      const sql = (await instance()).stages.sql;
      const r1 = await call(sqlRoute, { query: "SELECT id AS boutique_id, nom, 0 AS valeur_ecart FROM boutiques LIMIT 3" });
      expect(r1).toMatchObject({ status: 200, body: { ok: false, gem: false, passed: 0, total: 2 } });
      assertOnlyScore(r1.text, r1.body);
      expect(await gems()).not.toContain("sql");

      clock = at(1.02); // ~1 s plus tard
      expect((await call(sqlRoute, { query: strip(sql.private.solutionSql) })).status).toBe(429);

      clock = at(1.1);
      const r3 = await call(sqlRoute, { query: strip(sql.private.solutionSql) });
      expect(r3).toMatchObject({ status: 200, body: { ok: true, gem: true, passed: 2, total: 2 } });
      assertOnlyScore(r3.text, r3.body);
      expect(await gems()).toContain("sql");

      const log = (await events()).filter((e) => ["sql.submit", "sql.result", "gem.obtained"].includes(e.type));
      expect(log.map((e) => e.type)).toEqual(["sql.submit", "sql.result", "sql.submit", "sql.result", "gem.obtained"]);
      expect(log[1].payload).toMatchObject({ passed: 0, total: 2, checks: [{ dataset: "visible", ok: false }, { dataset: "cache", ok: false }] });
    });

    it("une requête vide est refusée sans compter comme essai", async () => {
      const res = await call(sqlRoute, { query: "  " });
      expect(res.status).toBe(400);
      expect((await events()).some((e) => e.type === "sql.submit")).toBe(false);
    });

    it("refusée après la fin (chrono serveur)", async () => {
      clock = at(45);
      expect((await call(sqlRoute, { query: "SELECT 1" })).status).toBe(409);
    });
  });
});
