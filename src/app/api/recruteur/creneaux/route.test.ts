import { beforeEach, describe, expect, it, vi } from "vitest";

// Session Auth.js simulée : chaque test choisit qui est « connecté ».
const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/db/client", () => ({ db: () => ({}) }));
vi.mock("@/server/slots/service", () => ({ listSlots: async () => [{ id: "s1" }] }));

const { GET } = await import("./route");

describe("GET /api/recruteur/creneaux", () => {
  beforeEach(() => {
    process.env.RECRUITER_EMAIL_DOMAIN = "olivesoft.test";
    authMock.mockReset();
  });

  it("401 sans session", async () => {
    authMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("401 avec une session hors du domaine (domaine revérifié à chaque requête)", async () => {
    authMock.mockResolvedValue({ user: { email: "x@gmail.com" } });
    expect((await GET()).status).toBe(401);
  });

  it("200 pour un recruteur du domaine", async () => {
    authMock.mockResolvedValue({ user: { email: "rh@olivesoft.test" } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "s1" }]);
  });
});
