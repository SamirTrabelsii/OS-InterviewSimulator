import type { Competence } from "@/engine/grille/types";

// Grille commune aux 4 scénarios. Version de travail : à relire avec
// l'équipe recrutement. Chaque compétence est notée de 1 à 4 par le
// recruteur, après la session, à partir du replay et du débrief
// (« non observé » autorisé).
export const competences: Competence[] = [
  {
    id: "sql",
    nom: "SQL et données",
    observer: "Gemme SQL (requêtes tentées, anomalies repérées).",
    niveaux: [
      "Ne parvient pas à écrire une requête qui s'exécute, même simple.",
      "Requêtes simples (SELECT, WHERE) ; bloque sur les jointures ou les agrégats.",
      "Jointures et agrégats corrects ; repère au moins un piège des données (NULL, doublons, casse).",
      "Requêtes propres et ciblées ; repère et signale les pièges sans indice ; vérifie ses résultats.",
    ],
  },
  {
    id: "algo",
    nom: "Python et algorithmique",
    observer: "Gemme Algo (versions du code, tests, essais).",
    niveaux: [
      "Code qui ne s'exécute pas ou ne traite pas le cas simple.",
      "Traite le cas simple ; oublie les cas limites.",
      "Solution correcte avec la plupart des cas limites ; code lisible.",
      "Solution correcte, claire et bien structurée ; anticipe les cas limites avant de soumettre.",
    ],
  },
  {
    id: "logique",
    nom: "Raisonnement logique",
    observer: "Gemme Logique (nombre d'essais, délai, démarche).",
    niveaux: [
      "Essais au hasard, sans méthode visible.",
      "Trouve avec beaucoup d'essais ou après un long blocage.",
      "Trouve avec une démarche visible et peu d'erreurs.",
      "Trouve rapidement et avec méthode ; sait expliquer son raisonnement au débrief.",
    ],
  },
  {
    id: "debug",
    nom: "Débogage et résolution de problèmes",
    observer: "Portail (exécutions, corrections successives).",
    niveaux: [
      "Modifie le code au hasard, sans hypothèse.",
      "Corrige un bug évident ; tâtonne sur les autres.",
      "Formule des hypothèses, les vérifie, corrige la plupart des bugs.",
      "Démarche méthodique (lire, reproduire, isoler, corriger, vérifier) ; corrige tous les bugs.",
    ],
  },
  {
    id: "collab",
    nom: "Communication et collaboration",
    observer: "Portail en binôme (appel Teams, demandes de main), débrief.",
    niveaux: [
      "Travaille seul, ignore son partenaire ou le monopolise.",
      "Communique peu ou de façon confuse.",
      "Partage l'information utile, écoute, passe la main quand il le faut.",
      "Structure l'échange (« qu'est-ce que tu vois dans les logs ? »), répartit le travail, reformule.",
    ],
  },
  {
    id: "client",
    nom: "Vulgarisation et sens client",
    observer: "Débrief (« explique au client ce qui s'est passé »).",
    niveaux: [
      "Explication incompréhensible pour un non-technicien.",
      "Explication juste mais jargonnante ou trop longue.",
      "Explication claire et adaptée au client.",
      "Claire, concise, rassurante sans mentir, avec une proposition d'action.",
    ],
  },
  {
    id: "culture",
    nom: "Culture technique générale",
    observer: "Gemme Quiz.",
    niveaux: [
      "Lacunes sur la plupart des thèmes.",
      "Bases correctes sur certains thèmes seulement.",
      "Bonne maîtrise de la plupart des thèmes.",
      "Très bonne maîtrise, y compris sécurité, Git et IA générative.",
    ],
  },
  {
    id: "ia",
    nom: "Usage critique de l'IA",
    observer: "Échanges avec Bip si activé, sinon question au débrief.",
    niveaux: [
      "Copie les réponses sans vérifier, ou colle des données sensibles.",
      "Utilise l'IA de façon vague, vérifie peu.",
      "Questions précises avec contexte ; vérifie les réponses.",
      "Utilise l'IA à bon escient, repère ses erreurs, protège les données.",
    ],
  },
  {
    id: "temps",
    nom: "Gestion du temps et du stress",
    observer: "Ordre des gemmes, réaction aux blocages et au chrono.",
    niveaux: [
      "Reste bloqué sans changer de stratégie ; se désorganise sous la pression.",
      "Avance mais gère mal ses priorités.",
      "Priorise, sait passer à autre chose et revenir.",
      "Calme et organisé ; ses choix d'ordre et de temps sont justifiés.",
    ],
  },
  {
    id: "honnetete",
    nom: "Honnêteté et rigueur",
    observer: "« Je ne sais pas » au quiz, débrief, signalement des doutes.",
    niveaux: [
      "Bluffe, s'attribue un travail qui n'est pas le sien, ou tente de tricher.",
      "Reconnaît ses limites seulement quand on le lui demande.",
      "Dit quand il ne sait pas ; signale ses doutes.",
      "Transparent en permanence ; distingue clairement ce qu'il a fait, ce qu'il suppose et ce que l'IA a proposé.",
    ],
    // ÉLIMINATOIRE sous 2.
    eliminatoireSous: 2,
  },
];
