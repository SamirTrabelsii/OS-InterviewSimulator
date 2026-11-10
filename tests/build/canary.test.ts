import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allCanaries } from "@/server/content/registry";
import { scanNextClientOutput } from "../support/canary-scan";

// Lancé par `npm run test:build` (après `next build`).
describe("build Next.js", () => {
  const nextDir = path.resolve(".next");

  it("existe", () => {
    expect(existsSync(path.join(nextDir, "BUILD_ID")), "lancez d'abord `npm run build`").toBe(true);
  });

  it("n'envoie aucune solution au navigateur (aucun canari côté client)", () => {
    const canaries = allCanaries();
    expect(canaries.length).toBeGreaterThan(0);
    const hits = scanNextClientOutput(nextDir, canaries);
    expect(hits, `Fuite de solution :\n${hits.map((h) => `${h.canary} dans ${h.file}`).join("\n")}`).toEqual([]);
  });
});
