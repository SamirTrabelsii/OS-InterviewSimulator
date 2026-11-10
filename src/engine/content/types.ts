import type { Rng } from "@/engine/rng";
import type { ScenarioMeta, Stages, StageId } from "./schemas";

/**
 * Ce qu'un scénario de /content doit exporter. Le moteur n'en connaît
 * que cette forme, jamais le nom d'un scénario en particulier.
 */
export type ScenarioDefinition = {
  meta: ScenarioMeta;
  /**
   * Canaris de chaque épreuve, fixes (indépendants de la graine) pour que
   * le test de build puisse les chercher sans générer de session.
   */
  canaries: Record<StageId, string>;
  /** Génère toutes les épreuves. Chaque épreuve tire dans `rng.fork(id)`. */
  build: (rng: Rng) => Stages;
};
