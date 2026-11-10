import "server-only";
import type { Rng } from "@/engine/rng";
import type { Stages } from "@/engine/content/schemas";

export const CANARY = "CANARI-retail-quiz-4b1e9c";

type Question = { id: string; prompt: string; correct: string; wrong: string[] };

// Banque de questions : 5 sont tirées par session. Le premier choix
// (`correct`) est la bonne réponse ; l'ordre affiché est mélangé.
const BANK: Question[] = [
  {
    id: "http-idempotent",
    prompt: "La caisse renvoie deux fois la même requête après une coupure réseau. Quelle méthode HTTP est censée être idempotente ?",
    correct: "PUT",
    wrong: ["POST", "PATCH", "CONNECT"],
  },
  {
    id: "sql-left-join",
    prompt: "Pour lister toutes les boutiques, y compris celles sans aucun inventaire saisi, on utilise :",
    correct: "LEFT JOIN depuis la table des boutiques",
    wrong: ["INNER JOIN", "CROSS JOIN", "UNION ALL"],
  },
  {
    id: "index-usage",
    prompt: "Un index sur inventaire(boutique_id) accélère surtout :",
    correct: "Les recherches et jointures filtrées sur boutique_id",
    wrong: ["Les INSERT massifs", "Le calcul de SUM() sur toute la table", "La compression des données"],
  },
  {
    id: "git-revert",
    prompt: "Un commit fautif est déjà poussé sur la branche partagée. La façon la plus sûre de l'annuler est :",
    correct: "git revert du commit",
    wrong: ["git reset --hard puis git push --force", "Supprimer la branche distante", "git commit --amend"],
  },
  {
    id: "python-mutable-default",
    prompt: "En Python, pourquoi éviter def ajouter(sku, panier=[]) ?",
    correct: "La liste par défaut est partagée entre tous les appels",
    wrong: ["Les listes sont interdites en paramètre", "Cela rend la fonction asynchrone", "Le paramètre devient obligatoire"],
  },
  {
    id: "complexity-lookup",
    prompt: "Pour vérifier très souvent si un code-barres a déjà été scanné, la structure la plus adaptée est :",
    correct: "Un ensemble (set) ou un dictionnaire",
    wrong: ["Une liste triée à chaque ajout", "Une chaîne de caractères concaténée", "Une liste parcourue du début"],
  },
  {
    id: "transaction",
    prompt: "Transférer du stock d'une boutique à une autre en deux UPDATE doit se faire :",
    correct: "Dans une seule transaction",
    wrong: ["Dans deux connexions différentes", "Avec un SELECT entre les deux, sans transaction", "En désactivant les contraintes"],
  },
  {
    id: "float-money",
    prompt: "Pour stocker des prix sans erreur d'arrondi, on préfère :",
    correct: "Des entiers en centimes (ou un type décimal)",
    wrong: ["Des flottants double précision", "Des chaînes de caractères libres", "Des flottants arrondis à l'affichage"],
  },
];

export function buildQuiz(rng: Rng): Stages["quiz"] {
  const picked = rng.sample(BANK, 5);
  const answers: Record<string, string> = {};
  const questions = picked.map((q) => {
    const choices = rng.shuffle([q.correct, ...q.wrong]).map((label, i) => ({ id: `c${i + 1}`, label }));
    answers[q.id] = choices.find((c) => c.label === q.correct)!.id;
    return { id: q.id, prompt: q.prompt, choices };
  });

  return {
    public: {
      title: "Gemme du Savoir",
      story:
        "Minuit sonne chez Maison Lumen. Le terminal de la réserve s'allume : « Prouvez que vous connaissez la maison avant d'aller plus loin. »",
      questions,
    },
    private: { canary: CANARY, answers },
  };
}
