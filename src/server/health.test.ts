import { afterAll, describe, expect, it, vi } from "vitest";
import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("renvoie ok quand la base répond", async () => {
    const report = await checkHealth(async () => 1);
    expect(report).toMatchObject({ status: "ok", db: "ok" });
  });

  it("renvoie dégradé sans divulguer l'erreur quand la base échoue", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await checkHealth(async () => {
      throw new Error("postgresql://user:secret@host/db refusé");
    });
    expect(report).toMatchObject({ status: "degrade", db: "erreur" });
    expect(JSON.stringify(report)).not.toContain("secret");
    spy.mockRestore();
  });

  it("renvoie dégradé quand la base ne répond pas à temps", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const report = await checkHealth(() => new Promise(() => {}), 50);
    expect(report.db).toBe("erreur");
    spy.mockRestore();
  });
});

// Test d'intégration : exécuté seulement si une base est configurée
// (docker compose up -d db + .env.local).
const hasDb = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDb)("checkHealth avec PostgreSQL", async () => {
  const { pool } = await import("@/server/db/client");
  afterAll(() => pool().end());

  it("joint la base locale et trouve les tables migrées", async () => {
    const report = await checkHealth(() => pool().query("select 1"));
    expect(report.status).toBe("ok");
    const { rows } = await pool().query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = any($1)",
      [["slots", "sessions", "events", "portal_rooms", "evaluations"]],
    );
    expect(rows[0].n).toBe(5);
  });
});
