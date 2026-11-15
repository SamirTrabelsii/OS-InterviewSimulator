import "server-only";
import { scenarios } from "@content/index";
import { buildInstance, toPublic } from "@/engine/content/instance";
import type { ScenarioInstance } from "@/engine/content/schemas";
import type { ScenarioDefinition } from "@/engine/content/types";
import type { Seed } from "@/engine/rng";

const byId = new Map<string, ScenarioDefinition>(scenarios.map((s) => [s.meta.id, s]));

export function listScenarios() {
  return scenarios.map((s) => s.meta);
}

function definition(scenarioId: string): ScenarioDefinition {
  const def = byId.get(scenarioId);
  if (!def) throw new Error(`Scénario inconnu : ${scenarioId}`);
  return def;
}

// Générer une instance coûte ~50 ms (énigme logique) et chaque soumission
// en a besoin : on garde les dernières en mémoire (1 à 3 sessions actives).
const CACHE_SIZE = 16;
const cache = new Map<string, ScenarioInstance>();

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Génère l'instance depuis le contenu ACTUEL (jamais en cache). Sert à figer le sujet d'une session. */
export function buildFromContent(scenarioId: string, seed: Seed): ScenarioInstance {
  return buildInstance(definition(scenarioId), seed);
}

/**
 * Instance générée depuis le contenu actuel, sans passer par la session.
 * Réservé aux tests et aux outils : le code applicatif doit lire le sujet
 * figé de la session (subject.ts), sinon un changement de contenu modifie
 * le sujet d'un candidat en cours.
 */
export function loadInstance(scenarioId: string, seed: Seed): ScenarioInstance {
  const key = `${scenarioId}:${String(seed)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const instance = deepFreeze(buildInstance(definition(scenarioId), seed));
  cache.set(key, instance);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return instance;
}

/** Ce qui peut être envoyé au navigateur du candidat. */
export function loadPublicInstance(scenarioId: string, seed: Seed) {
  return toPublic(loadInstance(scenarioId, seed));
}

/** Tous les canaris connus, pour le test de build. */
export function allCanaries(): string[] {
  return scenarios.flatMap((s) => Object.values(s.canaries));
}
