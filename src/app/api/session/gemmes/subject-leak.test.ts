// Fuites du sujet figé : la copie en base contient solutions et tests cachés.
// Ce test lit CETTE copie (pas le contenu) et vérifie que rien de secret
// n'atteint le candidat : partie publique, réponses de toutes les routes
// candidat (succès comme échecs). Projet « sandbox » : SQL et Algo exécutés.
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

const candidateMock = vi.fn();
vi.mock("@/server/candidate/current", () => ({ currentCandidate: () => candidateMock() }));

const PRIVATE_KEYS = ["canary", "answers", "solutionSql", "hiddenDataset", "referenceSolution", "hiddenTests", "answer", "fixedSolution", "bugs", "orderMatters"];
const stripComment = (code: string) => code.replace(/^(--|#).*\n/, "").trim();

describe.runIf(Boolean(process.env.DATABASE_URL))("sujet figé : aucune fuite vers le candidat", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { startSession, loadCandidateView } = await import("@/server/candidate/session");
  const { allCanaries } = await import("@/server/content/registry");
  const { clearSubjectCache, loadSessionPublic, loadStoredSubject } = await import("@/server/content/subject");
  const { getSandbox } = await import("@/server/sandbox/pool");
  const quizRoute = await import("./quiz/route");
  const logiqueRoute = await import("./logique/route");
  const sqlRoute = await import("./sql/route");
  const algoRoute = await import("./algo/route");
  const eventsRoute = await import("../events/route");
  const heartbeatRoute = await import("../heartbeat/route");

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
  let seed = 0n;
  let clock = at(1);

  beforeEach(async () => {
    clearSubjectCache();
    const input = createSlotInput.parse({ scenario: "retail", mode: "solo", scheduledAt: t0.toISOString(), candidates: ["Test Fuites"] });
    const { slotId, links } = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(slotId);
    sessionId = links[0].sessionId;
    seed = (await db().select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)))[0].seed;
    await startSession(db(), sessionId, at(0));
    clock = at(1);
    candidateMock.mockImplementation(async () => {
      const view = await loadCandidateView(db(), sessionId, clock);
      return { view, deviceId: "d", now: clock };
    });
  });

  /** Tout ce qui est secret dans le sujet figé, sous forme de textes qu'on ne doit jamais retrouver. */
  const secretsOf = async () => {
    const s = (await loadStoredSubject(db(), sessionId))!.stages;
    return [
      ...allCanaries(),
      stripComment(s.sql.private.solutionSql),
      stripComment(s.algo.private.referenceSolution),
      stripComment(s.portail.private.fixedSolution),
      ...s.portail.private.bugs,
      ...[...s.algo.private.hiddenTests, ...s.portail.private.hiddenTests].map((t) => JSON.stringify(t.expected)).filter((t) => t.length > 40),
      ...s.sql.private.hiddenDataset.tables.map((t) => JSON.stringify(t.rows)),
    ];
  };

  const expectClean = (label: string, text: string, secrets: string[]) => {
    for (const secret of secrets) expect(text, `${label} contient un secret`).not.toContain(secret);
    for (const key of PRIVATE_KEYS) expect(text, `${label} contient la clé privée « ${key} »`).not.toContain(`"${key}"`);
  };

  type Route = { POST: (r: Request) => Promise<Response> };
  const post = async (route: Route, body?: unknown) => {
    const res = await route.POST(new Request("http://x", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }));
    return res.text();
  };

  it("la partie publique du sujet figé ne contient rien de privé", async () => {
    const secrets = await secretsOf();
    expectClean("loadSessionPublic", JSON.stringify(await loadSessionPublic(db(), { sessionId, scenarioId: "retail", seed })), secrets);
  });

  it("aucune réponse des routes candidat ne laisse échapper le sujet figé", async () => {
    const secrets = await secretsOf();
    const s = (await loadStoredSubject(db(), sessionId))!.stages;

    // Réponses fausses, malformées, trop rapides, puis justes : chaque cas est une réponse candidat.
    const answers: [string, string][] = [];
    const run = async (label: string, route: Route, body?: unknown) => answers.push([label, await post(route, body)]);

    await run("quiz faux", quizRoute, { answers: Object.fromEntries(s.quiz.public.questions.map((q) => [q.id, q.choices[0].id])) });
    await run("quiz mal formé", quizRoute, { answers: { inventee: "c1" } });
    await run("logique fausse", logiqueRoute, { answer: s.logique.private.answer === "0123" ? "9876" : "0123" });
    await run("logique trop rapide", logiqueRoute, { answer: "0123" });
    clock = at(1.2);
    await run("logique juste", logiqueRoute, { answer: s.logique.private.answer });
    await run("sql faux", sqlRoute, { query: "SELECT id AS boutique_id, nom, 0 AS valeur_ecart FROM boutiques LIMIT 3" });
    await run("sql en erreur", sqlRoute, { query: "SELECT * FROM table_inexistante" });
    await run("algo faux", algoRoute, { code: "def compter_scans(scans, k):\n    print(scans)\n    return {}\n" });
    await run("algo qui plante", algoRoute, { code: "def compter_scans(scans, k):\n    raise ValueError('boom')\n" });
    clock = at(1.5);
    await run("sql juste", sqlRoute, { query: stripComment(s.sql.private.solutionSql) });
    await run("algo juste", algoRoute, { code: stripComment(s.algo.private.referenceSolution) });
    await run("événements", eventsRoute, [{ type: "stage.enter", clientTs: Date.now(), payload: { stage: "quiz" } }]);
    await run("battement", heartbeatRoute);

    expect(answers.length).toBeGreaterThan(10);
    for (const [label, text] of answers) expectClean(label, text, secrets);
  });
});
