import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { devShortcutsEnabled } from "./shortcuts";

describe("raccourcis dev : jamais en production", () => {
  it("actifs seulement hors production avec AUTH_DEV_LOGIN=true", () => {
    expect(devShortcutsEnabled({ NODE_ENV: "development", AUTH_DEV_LOGIN: "true" })).toBe(true);
    expect(devShortcutsEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(devShortcutsEnabled({ NODE_ENV: "production", AUTH_DEV_LOGIN: "true" })).toBe(false);
  });

  it("devOpenPortal refuse en production, avant tout accès à la base", async () => {
    const { devOpenPortal } = await import("./shortcuts");
    const boom = new Proxy({}, { get() { throw new Error("base touchée"); } }) as never;
    await expect(
      devOpenPortal(boom, "00000000-0000-4000-8000-000000000000", new Date(), { NODE_ENV: "production", AUTH_DEV_LOGIN: "true" }),
    ).rejects.toThrow("Raccourci indisponible");
  });

  it("le bouton n'est rendu et l'action n'agit que derrière devShortcutsEnabled", () => {
    const page = readFileSync(join(process.cwd(), "src/app/recruteur/page.tsx"), "utf8");
    // La page ne transmet le drapeau qu'à partir de devShortcutsEnabled() ;
    // la vue ne rend le bouton que si ce drapeau (faux par défaut) est vrai.
    expect(page).toMatch(/devShortcuts=\{devShortcutsEnabled\(\)\}/);
    const view = readFileSync(join(process.cwd(), "src/app/recruteur/DashboardView.tsx"), "utf8");
    expect(view).toMatch(/devShortcuts = false/);
    expect(view).toMatch(/devShortcuts\s*&&[^]*<DevOpenPortal/);
    const actions = readFileSync(join(process.cwd(), "src/app/recruteur/actions.ts"), "utf8");
    expect(actions).toMatch(/if \(!devShortcutsEnabled\(\)\) return/);
  });

  it("seuls la page, l'action et le module dev référencent le raccourci", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts") && /devOpenPortal/.test(readFileSync(p, "utf8"))) {
          hits.push(p.replaceAll("\\", "/").split("src/")[1]);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits.sort()).toEqual(["app/recruteur/DevOpenPortal.tsx", "app/recruteur/actions.ts", "server/dev/shortcuts.ts"]);
  });
});

describe.runIf(Boolean(process.env.DATABASE_URL))("devOpenPortal (PostgreSQL)", async () => {
  const { db, pool } = await import("@/server/db/client");
  const schema = await import("@/server/db/schema");
  const { createSlot, createSlotInput } = await import("@/server/slots/service");
  const { loadCandidateView } = await import("@/server/candidate/session");
  const { devOpenPortal } = await import("./shortcuts");
  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db().delete(schema.slots).where(eq(schema.slots.id, id));
    await pool().end();
  });

  it("ouvre le Portail pour les deux candidats et renvoie deux liens", async () => {
    const input = createSlotInput.parse({ scenario: "retail", mode: "binome", scheduledAt: new Date().toISOString(), candidates: ["Ana", "Bo"] });
    const res = await createSlot(db(), input, "rh@olivesoft.test", ["retail"]);
    created.push(res.slotId);
    const now = new Date();
    const links = await devOpenPortal(db(), res.slotId, now, { NODE_ENV: "development", AUTH_DEV_LOGIN: "true" });
    expect(links).toHaveLength(2);
    for (const l of res.links) {
      expect((await loadCandidateView(db(), l.sessionId, new Date(now.getTime() + 1000)))?.phase).toBe("portail");
    }
  });
});
