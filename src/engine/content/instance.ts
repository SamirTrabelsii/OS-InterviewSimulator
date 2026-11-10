import { Rng, type Seed } from "@/engine/rng";
import {
  publicInstanceSchema,
  scenarioInstanceSchema,
  STAGE_IDS,
  type PublicInstance,
  type ScenarioInstance,
} from "./schemas";
import type { ScenarioDefinition } from "./types";

/** Génère et valide l'instance complète (publique + privée) d'un scénario. */
export function buildInstance(def: ScenarioDefinition, seed: Seed): ScenarioInstance {
  const instance = scenarioInstanceSchema.parse({
    meta: def.meta,
    stages: def.build(new Rng(seed, def.meta.id)),
  });
  for (const stageId of STAGE_IDS) {
    if (instance.stages[stageId].private.canary !== def.canaries[stageId]) {
      throw new Error(`Canari incohérent pour ${def.meta.id}/${stageId}`);
    }
  }
  return instance;
}

/**
 * Seule porte de sortie vers le navigateur : construit explicitement la
 * partie publique, puis la revalide avec des schémas stricts.
 */
export function toPublic(instance: ScenarioInstance): PublicInstance {
  const { stages } = instance;
  return publicInstanceSchema.parse({
    meta: instance.meta,
    stages: {
      quiz: stages.quiz.public,
      sql: stages.sql.public,
      algo: stages.algo.public,
      logique: stages.logique.public,
      portail: stages.portail.public,
    },
  });
}
