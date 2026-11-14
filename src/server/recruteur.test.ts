// Notation et replay : réservés aux recruteurs, jamais côté candidat.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------- étanchéité (statique)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe("les routes et pages candidat ne touchent jamais aux notes", () => {
  // Tout ce qui est servi au candidat : pages /session, lien /s, routes /api/session, accès candidat, gemmes, Portail.
  const candidateSide = ["src/app/session", "src/app/s", "src/app/api/session", "src/app/lien-invalide", "src/server/candidate", "src/server/gems"];
  const forbidden = [/evaluations/i, /profile_?fit/i, /grading\/evaluations/, /@content\/grille/, /engine\/grille/, /recruteur\/sessions/];

  it("aucun fichier côté candidat ne référence evaluations, l'adéquation ou la grille", () => {
    const offenders: string[] = [];
    for (const dir of candidateSide) {
      for (const file of sourceFiles(dir)) {
        const src = readFileSync(file, "utf8");
        for (const re of forbidden) if (re.test(src)) offenders.push(`${file} ~ ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("le Portail (socket) ne lit pas non plus les notes", () => {
    for (const file of sourceFiles("src/server/portal")) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/evaluations|profile_?fit/i);
    }
  });
});

// ---------------------------------------------------------------- routes recruteur (auth)

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
const loadReplay = vi.fn(async () => ({ sessionId: "x", events: [] }));
const loadMyEvaluation = vi.fn(async () => null);
const saveEvaluation = vi.fn(async () => ({ ok: true }));
vi.mock("@/server/db/client", () => ({ db: () => ({}) }));
vi.mock("@/server/grading/evaluations", () => ({ loadReplay, loadMyEvaluation, saveEvaluation }));

const ID = "11111111-2222-4333-8444-555555555555";
const ctx = { params: Promise.resolve({ id: ID }) };
const replay = await import("@/app/api/recruteur/sessions/[id]/replay/route");
const evaluation = await import("@/app/api/recruteur/sessions/[id]/evaluation/route");
const put = (body: unknown) => new Request("http://x", { method: "PUT", body: JSON.stringify(body) });

describe("routes recruteur : replay et notation", () => {
  beforeEach(() => {
    process.env.RECRUITER_EMAIL_DOMAIN = "olivesoft.test";
    authMock.mockReset();
    loadReplay.mockClear();
    saveEvaluation.mockClear();
  });

  it("401 sans session, ou hors du domaine, sans toucher aux données", async () => {
    for (const session of [null, { user: { email: "x@gmail.com" } }]) {
      authMock.mockResolvedValue(session);
      expect((await replay.GET(new Request("http://x"), ctx)).status).toBe(401);
      expect((await evaluation.GET(new Request("http://x"), ctx)).status).toBe(401);
      expect((await evaluation.PUT(put({ grid: {} }), ctx)).status).toBe(401);
    }
    expect(loadReplay).not.toHaveBeenCalled();
    expect(saveEvaluation).not.toHaveBeenCalled();
  });

  it("recruteur du domaine : accès, notation enregistrée sous SON adresse", async () => {
    authMock.mockResolvedValue({ user: { email: "rh@olivesoft.test" } });
    expect((await replay.GET(new Request("http://x"), ctx)).status).toBe(200);
    expect((await evaluation.PUT(put({ grid: {} }), ctx)).status).toBe(200);
    expect(saveEvaluation).toHaveBeenCalledWith(expect.anything(), ID, "rh@olivesoft.test", { grid: {} });
  });

  it("400 sur un identifiant qui n'est pas un UUID", async () => {
    authMock.mockResolvedValue({ user: { email: "rh@olivesoft.test" } });
    expect((await replay.GET(new Request("http://x"), { params: Promise.resolve({ id: "pas-un-uuid" }) })).status).toBe(400);
  });
});

// ---------------------------------------------------------------- base de données

describe.runIf(Boolean(process.env.DATABASE_URL))("notation (PostgreSQL)", async () => {
  vi.doUnmock("@/server/grading/evaluations");
  vi.doUnmock("@/server/db/client");
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { appendEvents } = await import("@/server/candidate/events");
  const real = await vi.importActual<typeof import("@/server/grading/evaluations")>("@/server/grading/evaluations");

  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  async function newSession() {
    const input = createSlotInput.parse({
      scenario: "retail",
      mode: "solo",
      scheduledAt: new Date("2026-12-01T09:00:00Z").toISOString(),
      candidates: ["Candidat Test"],
    });
    const slot = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(slot.slotId);
    return slot.links[0].sessionId;
  }

  it("enregistre, recalcule l'adéquation côté serveur et isole chaque recruteur", async () => {
    const sessionId = await newSession();
    const grid = {
      sql: { note: 4, moment: 12_000, why: "jointure propre" },
      client: { note: 4 },
      honnetete: { note: 3 },
      algo: { note: null },
    };
    const saved = await real.saveEvaluation(db(), sessionId, "a@olivesoft.test", { grid, comment: "bien" });
    expect(saved?.result.nonRetenu).toBe(false);
    expect(saved?.result.adequations.find((a) => a.profil === "bi")?.pourcentage).toBe(Math.round(((4 * 4 + 4 * 4 + 3 * 3) / (4 * (4 + 4 + 3))) * 100));

    // le recruteur B ne voit pas la note de A ; il écrit la sienne sans écraser celle de A
    expect(await real.loadMyEvaluation(db(), sessionId, "b@olivesoft.test")).toBeNull();
    await real.saveEvaluation(db(), sessionId, "b@olivesoft.test", { grid: { honnetete: { note: 1 } } });
    expect((await real.loadMyEvaluation(db(), sessionId, "b@olivesoft.test"))?.result.nonRetenu).toBe(true);
    const mine = await real.loadMyEvaluation(db(), sessionId, "a@olivesoft.test");
    expect(mine?.comment).toBe("bien");
    expect(mine?.grid.sql).toMatchObject({ note: 4, moment: 12_000, why: "jointure propre" });

    // un second enregistrement remplace (pas de doublon)
    await real.saveEvaluation(db(), sessionId, "a@olivesoft.test", { grid: { sql: { note: 2 } } });
    const rows = await db().select().from(schema.evaluations).where(eq(schema.evaluations.sessionId, sessionId));
    expect(rows).toHaveLength(2);
  });

  it("refuse une note hors 1-4 ou une compétence inconnue ; session inconnue → null", async () => {
    const sessionId = await newSession();
    await expect(real.saveEvaluation(db(), sessionId, "a@olivesoft.test", { grid: { sql: { note: 5 } } })).rejects.toThrow();
    await expect(real.saveEvaluation(db(), sessionId, "a@olivesoft.test", { grid: { magie: { note: 4 } } })).rejects.toThrow();
    expect(await real.saveEvaluation(db(), "00000000-0000-4000-8000-000000000000", "a@olivesoft.test", { grid: {} })).toBeNull();
  });

  it("le replay renvoie les événements avec des temps relatifs au début de session", async () => {
    const sessionId = await newSession();
    const t0 = new Date("2026-12-01T09:00:00Z");
    await db().update(schema.sessions).set({ startedAt: t0 }).where(eq(schema.sessions.id, sessionId));
    await appendEvents(db(), sessionId, "candidat", [{ type: "stage.enter", payload: { stage: "sql" } }], new Date(t0.getTime() + 5_000));
    await appendEvents(db(), sessionId, "systeme", [{ type: "gem.obtained", payload: { gem: "sql" } }], new Date(t0.getTime() + 60_000));
    const r = await real.loadReplay(db(), sessionId);
    expect(r?.candidateName).toBe("Candidat Test");
    expect(r?.events.map((e) => [e.type, e.t])).toEqual([
      ["stage.enter", 5_000],
      ["gem.obtained", 60_000],
    ]);
    expect(await real.loadReplay(db(), "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
