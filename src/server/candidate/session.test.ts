import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { decodeCandidateCookie, encodeCandidateCookie } from "./cookie";

describe("cookie candidat", () => {
  process.env.AUTH_SECRET ??= "secret-de-test-suffisamment-long";
  const value = encodeCandidateCookie({ sessionId: "11111111-2222-3333-4444-555555555555", deviceId: "abc" });

  it("se relit tel quel", () => {
    expect(decodeCandidateCookie(value)).toEqual({ sessionId: "11111111-2222-3333-4444-555555555555", deviceId: "abc" });
  });
  it("refuse une signature ou un identifiant modifié", () => {
    expect(decodeCandidateCookie(value.slice(0, -2) + "xx")).toBeNull();
    expect(decodeCandidateCookie(value.replace("1111", "9999"))).toBeNull();
    expect(decodeCandidateCookie("n'importe.quoi.du-tout")).toBeNull();
    expect(decodeCandidateCookie(undefined)).toBeNull();
  });
});

describe.runIf(Boolean(process.env.DATABASE_URL))("session candidat (PostgreSQL)", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { appendEvents } = await import("./events");
  const { openLink, startSession, loadCandidateView, assertCanSubmit, acceptsClientEvents, SessionError } = await import("./session");

  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  const scheduledAt = new Date("2026-12-01T09:00:00Z");
  const at = (min: number) => new Date(scheduledAt.getTime() + min * 60_000);
  const device = (deviceId: string) => ({ deviceId, userAgent: "vitest" });

  async function newSlot(mode: "solo" | "binome" = "binome") {
    const input = createSlotInput.parse({
      scenario: "retail",
      mode,
      scheduledAt: scheduledAt.toISOString(),
      candidates: mode === "solo" ? ["Solo Test"] : ["Ana Test", "Bo Test"],
    });
    const res = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(res.slotId);
    return res;
  }

  const events = (sessionId: string) =>
    db().select().from(schema.events).where(eq(schema.events.sessionId, sessionId)).orderBy(asc(schema.events.seq));

  it("refuse un jeton inconnu", async () => {
    expect(await openLink(db(), "jeton-bidon", at(0), device("d1"))).toEqual({ ok: false, reason: "invalide" });
  });

  it("refuse un lien trop tôt ou expiré, accepte dans la fenêtre", async () => {
    const { links } = await newSlot();
    const token = links[0].token;
    expect(await openLink(db(), token, at(-16), device("d1"))).toMatchObject({ ok: false, reason: "pas-encore" });
    expect(await openLink(db(), token, at(121), device("d1"))).toMatchObject({ ok: false, reason: "expire" });
    expect(await openLink(db(), token, at(-5), device("d1"))).toMatchObject({ ok: true, newDevice: false });
  });

  it("journalise une reprise sur un second appareil", async () => {
    const { links } = await newSlot();
    const [{ token, sessionId }] = links;
    await openLink(db(), token, at(0), device("pc-candidat"));
    await startSession(db(), sessionId, at(1));
    const second = await openLink(db(), token, at(10), device("pc-bureau"));
    expect(second).toMatchObject({ ok: true, newDevice: true });

    const opens = (await events(sessionId)).filter((e) => e.type === "access.open");
    expect(opens.at(-1)?.payload).toMatchObject({ deviceId: "pc-bureau", newDevice: true, afterStart: true });
  });

  it("le binôme partage T0 ; on ne démarre pas avant l'heure prévue", async () => {
    const { links } = await newSlot();
    await expect(startSession(db(), links[0].sessionId, at(-1))).rejects.toBeInstanceOf(SessionError);

    const a = await startSession(db(), links[0].sessionId, at(2));
    const b = await startSession(db(), links[1].sessionId, at(7));
    expect(b.t0).toEqual(a.t0);
    expect(b.deadline).toEqual(at(47));

    // Idempotent
    expect(await startSession(db(), links[0].sessionId, at(9))).toEqual(a);
    expect((await events(links[0].sessionId)).filter((e) => e.type === "session.start")).toHaveLength(1);
  });

  it("refuse une soumission après la fin (horloge simulée) et clôt la session", async () => {
    const { links } = await newSlot("solo");
    const { sessionId } = links[0];
    await startSession(db(), sessionId, at(0));

    const during = (await loadCandidateView(db(), sessionId, at(44)))!;
    expect(() => assertCanSubmit(during, at(44))).not.toThrow();

    const after = (await loadCandidateView(db(), sessionId, at(45)))!;
    expect(after.phase).toBe("termine");
    expect(() => assertCanSubmit(after, at(45))).toThrow(SessionError);
    expect(acceptsClientEvents(after, at(46))).toBe(true); // délai de grâce
    expect(acceptsClientEvents(after, at(48))).toBe(false);

    const [row] = await db().select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
    expect(row.status).toBe("terminee");
    expect((await events(sessionId)).some((e) => e.type === "session.end")).toBe(true);
    expect(await openLink(db(), links[0].token, at(50), device("d1"))).toMatchObject({ ok: false, reason: "termine" });
  });

  it("numérote les événements sans trou ni doublon, même en écritures concurrentes", async () => {
    const { links } = await newSlot("solo");
    const { sessionId } = links[0];
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => appendEvents(db(), sessionId, "candidat", [{ type: "focus.lost", payload: { i } }, { type: "focus.gained" }])),
    );
    const seqs = (await events(sessionId)).map((e) => e.seq);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});
