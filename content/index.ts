import "server-only";
import type { ScenarioDefinition } from "@/engine/content/types";
import { retail } from "./retail";

// Registre des scénarios. Ajouter un scénario = l'importer ici.
// ecommerce, education, hotellerie : étape 11 de docs/ROADMAP.md.
export const scenarios: ScenarioDefinition[] = [retail];
