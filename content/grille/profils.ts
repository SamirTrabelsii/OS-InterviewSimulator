import type { Profil } from "@/engine/grille/types";

// Poids de 1 à 4 par compétence. À calibrer : faire passer 4 ou 5 juniors
// d'Olivesoft et vérifier que leur meilleur pourcentage correspond bien à
// leur métier réel.
export const profils: Profil[] = [
  {
    id: "data-engineer",
    nom: "Data engineer",
    poids: { sql: 4, algo: 4, logique: 3, debug: 4, collab: 3, client: 2, culture: 2, ia: 2, temps: 3, honnetete: 3 },
  },
  {
    id: "bi",
    nom: "BI",
    poids: { sql: 4, algo: 2, logique: 3, debug: 2, collab: 3, client: 4, culture: 2, ia: 2, temps: 3, honnetete: 3 },
  },
  {
    id: "ia",
    nom: "IA",
    poids: { sql: 2, algo: 4, logique: 4, debug: 3, collab: 3, client: 3, culture: 3, ia: 4, temps: 3, honnetete: 3 },
  },
  {
    id: "salesforce",
    nom: "Salesforce",
    poids: { sql: 3, algo: 2, logique: 3, debug: 3, collab: 3, client: 4, culture: 2, ia: 2, temps: 3, honnetete: 3 },
  },
];
