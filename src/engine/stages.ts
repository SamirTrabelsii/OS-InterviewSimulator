// Nature des 4 épreuves, affichée au candidat (accueil, sous-titres du quartier).
// Même libellés pour tous les scénarios : seul le contenu change.
import type { GemId } from "./timeline";

export const STAGE_KIND: Record<GemId, { subtitle: string; detail: string }> = {
  quiz: { subtitle: "Quiz", detail: "des questions à choix, une seule tentative" },
  sql: { subtitle: "SQL", detail: "écrire une requête sur un jeu de données" },
  algo: { subtitle: "Python", detail: "écrire une fonction, testée sur des cas cachés" },
  logique: { subtitle: "Logique", detail: "une énigme à résoudre, essais illimités" },
};

/** Règles communes annoncées avant le départ (accueil). */
export const RULES = {
  allowed: [
    "la documentation officielle des outils (Python, SQL/SQLite, Git, MDN…)",
    "vos notes personnelles (papier ou fichier)",
  ],
  forbidden: ["tout assistant d'IA externe (ChatGPT, Copilot, Gemini…)", "l'aide d'une autre personne que votre binôme"],
  tabs: "Les changements d'onglet sont notés pour le recruteur, sans pénalité automatique : consulter la documentation est normal.",
} as const;
