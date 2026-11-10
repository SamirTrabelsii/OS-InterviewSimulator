import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type CanaryHit = { file: string; canary: string };

/**
 * Cherche des canaris dans les fichiers d'un dossier (récursif).
 * `filter` choisit les fichiers à lire (par défaut : tous).
 */
export function scanForCanaries(
  dir: string,
  canaries: string[],
  filter: (file: string) => boolean = () => true,
): CanaryHit[] {
  if (!existsSync(dir)) return [];
  const hits: CanaryHit[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath, entry.name);
    if (!filter(file)) continue;
    const content = readFileSync(file, "latin1"); // lit aussi les fichiers binaires sans erreur
    for (const canary of canaries) {
      if (content.includes(canary)) hits.push({ file, canary });
    }
  }
  return hits;
}

/**
 * Fichiers d'un build Next.js qui peuvent atteindre le navigateur :
 * tout `.next/static`, et les pages prérendues (HTML, charges RSC).
 * Le code serveur (`.next/server/chunks`, etc.) contient légitimement
 * les solutions et n'est pas scanné.
 */
export function scanNextClientOutput(nextDir: string, canaries: string[]): CanaryHit[] {
  const prerendered = /\.(html|rsc|body|json)$/;
  return [
    ...scanForCanaries(path.join(nextDir, "static"), canaries),
    ...scanForCanaries(path.join(nextDir, "server", "app"), canaries, (f) => prerendered.test(f)),
    ...scanForCanaries(path.join(nextDir, "server", "pages"), canaries, (f) => prerendered.test(f)),
  ];
}
