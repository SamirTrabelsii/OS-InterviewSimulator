import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

describe.runIf(Boolean(process.env.DATABASE_URL))("repli solo (PostgreSQL)", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { startSession, loadCandidateView } = await import("@/server/candidate/session");
  const { switchToSolo, SoloError } = await import("./solo");

  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  const scheduledAt = new Date("2026-12-01T09:00:00Z");
  const at = (min: number) => new Date(scheduledAt.getTime() + min * 60_000);

  async function started() {
    const input = createSlotInput.parse({ scenario: "retail", mode: "binome", scheduledAt: scheduledAt.toISOString(), candidates: ["Ana", "Bo"] });
    const res = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(res.slotId);
    return res;
  }

  it("retire le partenaire, passe le créneau en solo et ne retient plus l'ouverture du Portail", async () => {
    const res = await started();
    const [ana, bo] = res.links;
    await startSession(db(), ana.sessionId, at(0));
    await db().update(schema.sessions).set({ gems: ["quiz", "sql", "algo", "logique"] }).where(eq(schema.sessions.id, ana.sessionId));
    expect((await loadCandidateView(db(), ana.sessionId, at(10)))?.phase).toBe("gemmes"); // Bo n'a rien : fermé

    expect(await switchToSolo(db(), res.slotId, ana.sessionId, "rh@olivesoft.test", at(11))).toEqual({ retired: [bo.sessionId] });
    expect((await loadCandidateView(db(), ana.sessionId, at(12)))?.phase).toBe("portail");
    expect(await loadCandidateView(db(), bo.sessionId, at(12))).toMatchObject({ phase: "termine", retired: true });
    const [slot] = await db().select().from(schema.slots).where(eq(schema.slots.id, res.slotId));
    expect(slot.mode).toBe("solo");
    const events = await db().select().from(schema.events).where(eq(schema.events.sessionId, ana.sessionId));
    expect(events.some((e) => e.type === "portail.solo" && e.actor === "recruteur")).toBe(true);
  });

  it("refuse un second repli, un créneau non démarré et un candidat non démarré", async () => {
    const res = await started();
    const [ana, bo] = res.links;
    await expect(switchToSolo(db(), res.slotId, ana.sessionId, "rh", at(1))).rejects.toMatchObject({ code: "pas-demarre" });
    await startSession(db(), ana.sessionId, at(0));
    await expect(switchToSolo(db(), res.slotId, bo.sessionId, "rh", at(1))).rejects.toBeInstanceOf(SoloError);
    await switchToSolo(db(), res.slotId, ana.sessionId, "rh", at(1));
    await expect(switchToSolo(db(), res.slotId, ana.sessionId, "rh", at(2))).rejects.toMatchObject({ code: "deja-solo" });
  });
});
