import { describe, expect, it } from "vitest";
import { buildProviders } from "./providers";

// Auth.js fusionne `options` (dont un `id` personnalisé) au démarrage : on lit l'id effectif.
const ids = (env: Record<string, string | undefined>) =>
  buildProviders(env).map((p) => {
    const cfg = (typeof p === "function" ? p() : p) as { id: string; options?: { id?: string } };
    return cfg.options?.id ?? cfg.id;
  });
const base = { RECRUITER_EMAIL_DOMAIN: "olivesoft.test" };

describe("buildProviders", () => {
  it("n'active le faux fournisseur qu'en dev avec AUTH_DEV_LOGIN=true", () => {
    expect(ids({ ...base, NODE_ENV: "development", AUTH_DEV_LOGIN: "true" })).toEqual(["dev"]);
    expect(ids({ ...base, NODE_ENV: "development" })).toEqual([]);
  });

  it("n'expose JAMAIS le faux fournisseur en production", () => {
    expect(ids({ ...base, NODE_ENV: "production", AUTH_DEV_LOGIN: "true" })).not.toContain("dev");
  });

  it("active Google seulement si ses identifiants sont fournis", () => {
    expect(ids({ ...base, NODE_ENV: "production", AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "s" })).toEqual(["google"]);
    expect(ids({ ...base, NODE_ENV: "production", AUTH_GOOGLE_ID: "id" })).toEqual([]);
  });
});
