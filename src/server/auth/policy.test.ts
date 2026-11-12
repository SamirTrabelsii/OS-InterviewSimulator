import { describe, expect, it } from "vitest";
import { devLoginEnabled, emailInDomain, isAllowedRecruiter } from "./policy";

const env = { RECRUITER_EMAIL_DOMAIN: "olivesoft.test", NODE_ENV: "development", AUTH_DEV_LOGIN: "true" };
const google = (profile: Record<string, unknown>) => ({ provider: "google", email: profile.email as string, profile });

describe("emailInDomain", () => {
  it("accepte le domaine exact, insensible à la casse", () => {
    expect(emailInDomain("Ana@Olivesoft.TEST", "olivesoft.test")).toBe(true);
  });
  it("refuse sous-domaines, suffixes et domaines piégés", () => {
    expect(emailInDomain("a@rh.olivesoft.test", "olivesoft.test")).toBe(false);
    expect(emailInDomain("a@evil-olivesoft.test", "olivesoft.test")).toBe(false);
    expect(emailInDomain("a@olivesoft.test.evil.com", "olivesoft.test")).toBe(false);
    expect(emailInDomain("olivesoft.test", "olivesoft.test")).toBe(false);
  });
});

describe("isAllowedRecruiter — Google", () => {
  const ok = { email: "ana@olivesoft.test", email_verified: true, hd: "olivesoft.test" };

  it("accepte un compte Workspace vérifié du domaine", () => {
    expect(isAllowedRecruiter(google(ok), env)).toBe(true);
  });
  it("refuse un domaine différent", () => {
    expect(isAllowedRecruiter(google({ ...ok, email: "ana@autre.com", hd: "autre.com" }), env)).toBe(false);
  });
  it("refuse un email non vérifié", () => {
    expect(isAllowedRecruiter(google({ ...ok, email_verified: false }), env)).toBe(false);
  });
  it("refuse un compte sans hd (Gmail personnel), même avec le bon suffixe", () => {
    expect(isAllowedRecruiter(google({ email: "ana@olivesoft.test", email_verified: true }), env)).toBe(false);
  });
  it("refuse tout si le domaine n'est pas configuré", () => {
    expect(isAllowedRecruiter(google(ok), { ...env, RECRUITER_EMAIL_DOMAIN: "" })).toBe(false);
  });
});

describe("isAllowedRecruiter — faux fournisseur de dev", () => {
  const dev = { provider: "dev", email: "test@olivesoft.test" };

  it("accepte en dev quand AUTH_DEV_LOGIN=true", () => {
    expect(isAllowedRecruiter(dev, env)).toBe(true);
  });
  it("refuse hors du domaine", () => {
    expect(isAllowedRecruiter({ ...dev, email: "x@gmail.com" }, env)).toBe(false);
  });
  it("est TOUJOURS refusé en production, même avec AUTH_DEV_LOGIN=true", () => {
    expect(devLoginEnabled({ ...env, NODE_ENV: "production" })).toBe(false);
    expect(isAllowedRecruiter(dev, { ...env, NODE_ENV: "production" })).toBe(false);
  });
  it("est refusé si AUTH_DEV_LOGIN n'est pas activé", () => {
    expect(isAllowedRecruiter(dev, { ...env, AUTH_DEV_LOGIN: undefined })).toBe(false);
  });
});

it("refuse un fournisseur inconnu", () => {
  expect(isAllowedRecruiter({ provider: "github", email: "a@olivesoft.test" }, env)).toBe(false);
});
