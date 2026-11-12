import { beforeEach, describe, expect, it, vi } from "vitest";

const candidateMock = vi.fn();
const appendMock = vi.fn(async (_db: unknown, _sid: string, _actor: string, events: unknown[]) => events.map((_e, i) => i + 1));
vi.mock("@/server/candidate/current", () => ({ currentCandidate: () => candidateMock() }));
vi.mock("@/server/db/client", () => ({ db: () => ({}) }));
vi.mock("@/server/candidate/events", async (orig) => ({
  ...(await orig<typeof import("@/server/candidate/events")>()),
  appendEvents: appendMock,
}));

const { POST } = await import("./route");

const t0 = new Date("2026-12-01T09:00:00Z");
const view = { sessionId: "s1", t0, deadline: new Date(t0.getTime() + 45 * 60_000) };
const post = (body: unknown) => POST(new Request("http://x/api/session/events", { method: "POST", body: JSON.stringify(body) }));
const ev = (type: string) => ({ type, clientTs: 1, payload: {} });

describe("POST /api/session/events", () => {
  beforeEach(() => {
    candidateMock.mockReset();
    appendMock.mockClear();
  });

  it("401 sans cookie candidat", async () => {
    candidateMock.mockResolvedValue(null);
    expect((await post([ev("focus.lost")])).status).toBe(401);
  });

  it("enregistre un lot valide avec l'appareil, côté candidat", async () => {
    candidateMock.mockResolvedValue({ view, deviceId: "d1", now: new Date(t0.getTime() + 60_000) });
    const res = await post([ev("focus.lost"), ev("focus.gained")]);
    expect(res.status).toBe(200);
    expect(appendMock).toHaveBeenCalledWith({}, "s1", "candidat", [
      { type: "focus.lost", payload: { clientTs: 1, deviceId: "d1" } },
      { type: "focus.gained", payload: { clientTs: 1, deviceId: "d1" } },
    ]);
  });

  it("refuse les types réservés au serveur (gemme, démarrage…)", async () => {
    candidateMock.mockResolvedValue({ view, deviceId: "d1", now: t0 });
    expect((await post([ev("gem.obtained")])).status).toBe(400);
    expect((await post([ev("session.start")])).status).toBe(400);
    expect(appendMock).not.toHaveBeenCalled();
  });

  it("410 après la fin + délai de grâce", async () => {
    candidateMock.mockResolvedValue({ view, deviceId: "d1", now: new Date(t0.getTime() + 48 * 60_000) });
    expect((await post([ev("focus.lost")])).status).toBe(410);
  });

  it("400 sur un JSON invalide", async () => {
    candidateMock.mockResolvedValue({ view, deviceId: "d1", now: t0 });
    const res = await POST(new Request("http://x", { method: "POST", body: "{pas du json" }));
    expect(res.status).toBe(400);
  });
});
