import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanNextClientOutput } from "./support/canary-scan";

// Vérifie que le scanner du test de build détecte bien une fuite
// (sinon un test de build « vert » ne prouverait rien).
describe("scanNextClientOutput", () => {
  const root = mkdtempSync(path.join(tmpdir(), "portail-canary-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const put = (rel: string, content: string) => {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  put("static/chunks/app/page-abc.js", 'const x="CANARI-test-fuite"');
  put("server/app/index.rsc", "0:CANARI-test-rsc");
  put("server/chunks/ssr/content.js", "CANARI-test-serveur"); // code serveur : autorisé
  put("static/chunks/propre.js", "rien ici");
  put("public/workers/worker.js", "CANARI-test-public");
  const publicDir = path.join(root, "public");

  it("détecte un canari dans le JS client, une page prérendue et public/", () => {
    const hits = scanNextClientOutput(root, ["CANARI-test-fuite", "CANARI-test-rsc", "CANARI-test-serveur", "CANARI-test-public"], publicDir);
    expect(hits.map((h) => h.canary).sort()).toEqual(["CANARI-test-fuite", "CANARI-test-public", "CANARI-test-rsc"]);
  });

  it("n'alerte pas sur le code serveur", () => {
    expect(scanNextClientOutput(root, ["CANARI-test-serveur"], publicDir)).toEqual([]);
  });
});
