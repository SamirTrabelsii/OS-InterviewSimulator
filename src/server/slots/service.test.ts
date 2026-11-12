import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { hashToken } from "@/server/tokens";
import { createSlotInput } from "./service";

describe("createSlotInput", () => {
  const base = { scenario: "retail", scheduledAt: "2026-12-01T09:00:00.000Z" };

  it("accepte un binôme à 2 candidats et un solo à 1", () => {
    expect(createSlotInput.safeParse({ ...base, mode: "binome", candidates: ["Ana", "Bo"] }).success).toBe(true);
    expect(createSlotInput.safeParse({ ...base, mode: "solo", candidates: ["Ana"] }).success).toBe(true);
  });

  it("refuse un nombre de candidats incohérent avec le format", () => {
    expect(createSlotInput.safeParse({ ...base, mode: "binome", candidates: ["Ana"] }).success).toBe(false);
    expect(createSlotInput.safeParse({ ...base, mode: "solo", candidates: ["Ana", "Bo"] }).success).toBe(false);
  });

  it("refuse une date invalide ou un nom vide", () => {
    expect(createSlotInput.safeParse({ ...base, scheduledAt: "pas une date", mode: "solo", candidates: ["Ana"] }).success).toBe(false);
    expect(createSlotInput.safeParse({ ...base, mode: "solo", candidates: ["  "] }).success).toBe(false);
  });
});

describe.runIf(Boolean(process.env.DATABASE_URL))("service des créneaux (PostgreSQL)", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, listSlots, regenerateLink } = await import("./service");
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  const input = createSlotInput.parse({
    scenario: "retail",
    mode: "binome",
    scheduledAt: "2026-12-01T09:00:00.000Z",
    candidates: ["Ana Test", "Bo Test"],
  });

  it("crée un créneau, 2 sessions, et ne stocke que le hash des jetons", async () => {
    const { slotId, links } = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(slotId);
    expect(links).toHaveLength(2);

    const rows = await db().select().from(schema.sessions).where(eq(schema.sessions.slotId, slotId));
    expect(rows).toHaveLength(2);
    for (const link of links) {
      const row = rows.find((r) => r.id === link.sessionId)!;
      expect(row.tokenHash).toBe(hashToken(link.token));
      expect(JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v))).not.toContain(link.token);
    }
    expect(rows[0].seed).not.toBe(rows[1].seed);
  });

  it("refuse un scénario inconnu", async () => {
    await expect(createSlot(db(), { ...input, scenario: "inconnu" }, "rh@olivesoft.test", ["retail"])).rejects.toThrow();
  });

  it("régénérer un lien invalide l'ancien", async () => {
    const { slotId, links } = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(slotId);
    const fresh = await regenerateLink(db(), links[0].sessionId);
    const [row] = await db().select().from(schema.sessions).where(eq(schema.sessions.id, links[0].sessionId));
    expect(row.tokenHash).toBe(hashToken(fresh.token));
    expect(row.tokenHash).not.toBe(hashToken(links[0].token));
  });

  it("listSlots n'expose ni jeton, ni hash, ni graine", async () => {
    const slots = await listSlots(db());
    const json = JSON.stringify(slots);
    expect(json).not.toMatch(/tokenHash|token_hash|seed/);
    expect(slots.some((s) => created.includes(s.id))).toBe(true);
  });
});
