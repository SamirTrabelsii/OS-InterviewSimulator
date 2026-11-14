import { grilleSchema, type Grille } from "@/engine/grille/types";
import { competences } from "./competences";
import { profils } from "./profils";

// Pas de "server-only" : la grille n'a rien de secret (elle s'affiche dans
// l'écran de notation du recruteur). Les NOTES, elles, ne quittent jamais
// les routes recruteur.
export const grille: Grille = grilleSchema.parse({ competences, profils });
