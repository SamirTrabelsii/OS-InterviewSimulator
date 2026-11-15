// Garde-fou statique : le sujet figé contient des solutions. Seuls quelques
// fichiers serveur ont le droit de le lire en entier ; tout le reste
// (pages, composants, routes candidat) ne reçoit que la partie publique.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve("src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
const rel = (p: string) => path.relative(SRC, p).replaceAll("\\", "/");
const sources = files(SRC).map((p) => ({ file: rel(p), text: readFileSync(p, "utf8") }));

const FULL_READERS = ["freezeSubject", "loadSessionInstance", "loadStoredSubject", "loadInstance", "buildFromContent", "buildInstance"];
// Fichiers autorisés à manipuler l'instance complète (privée comprise).
const ALLOWED = new Set([
  "server/content/subject.ts",
  "server/content/registry.ts",
  "engine/content/instance.ts",
  "server/candidate/session.ts", // fige au démarrage, ne renvoie rien
  "server/gems/http.ts", // correction des soumissions : renvoie des scores
  "server/portal/boot.ts", // correction du Portail, partie publique seule vers les clients
  "server/grading/evaluations.ts", // revue recruteur : champs publics des questions seulement
]);

describe("lecture du sujet figé", () => {
  it("seuls les fichiers autorisés lisent l'instance complète", () => {
    const offenders = sources
      .filter((s) => !ALLOWED.has(s.file))
      .filter((s) => FULL_READERS.some((name) => new RegExp(`\\b${name}\\b`).test(s.text)))
      .map((s) => s.file);
    expect(offenders, "ces fichiers lisent le sujet complet : utilisez loadSessionPublic ou ajoutez-les ici après relecture").toEqual([]);
  });

  it("les pages et composants (src/app hors api, src/ui) n'importent que la partie publique", () => {
    const offenders = sources
      .filter((s) => (s.file.startsWith("app/") && !s.file.startsWith("app/api/")) || s.file.startsWith("ui/"))
      .filter((s) => /server\/content\/subject"/.test(s.text))
      .filter((s) => !/import \{ loadSessionPublic \} from "@\/server\/content\/subject"/.test(s.text))
      .map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("la revue recruteur n'expose que des champs publics des questions", () => {
    const text = sources.find((s) => s.file === "server/grading/evaluations.ts")!.text;
    expect(text).not.toMatch(/\.private\b/);
  });

  it("le Portail n'envoie aux clients que la partie publique du sujet", () => {
    const text = sources.find((s) => s.file === "server/portal/boot.ts")!.text;
    expect(text).toMatch(/portail\(info\)\.public/);
  });
});
