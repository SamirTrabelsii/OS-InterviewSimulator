import "server-only";
import type { ScenarioDefinition } from "@/engine/content/types";
import { buildAlgo, CANARY as ALGO } from "./algo";
import { buildLogique, CANARY as LOGIQUE } from "./logique";
import { buildPortail, CANARY as PORTAIL } from "./portail";
import { buildQuiz, CANARY as QUIZ } from "./quiz";
import { buildSql, CANARY as SQL } from "./sql";

// « L'inventaire de minuit » — Maison Lumen, 40 boutiques.
// Textes à relire par l'équipe recrutement avant la première campagne.
export const retail: ScenarioDefinition = {
  meta: {
    id: "retail",
    title: "L'inventaire de minuit",
    company: "Maison Lumen",
    pitch:
      "Maison Lumen, 40 boutiques de décoration. Cette nuit, l'inventaire annuel a déraillé et la réserve centrale s'est verrouillée. " +
      "Réunissez les 4 gemmes pour rouvrir le Portail avant l'ouverture des magasins.",
    epilogue:
      "Le Portail s'ouvre. À 6 h, les commandes de réassort partent vers les 40 boutiques et les rayons seront pleins à l'ouverture. " +
      "Merci pour cette nuit chez Maison Lumen !",
  },
  canaries: { quiz: QUIZ, sql: SQL, algo: ALGO, logique: LOGIQUE, portail: PORTAIL },
  build: (rng) => ({
    quiz: buildQuiz(rng.fork("quiz")),
    sql: buildSql(rng.fork("sql")),
    algo: buildAlgo(rng.fork("algo")),
    logique: buildLogique(rng.fork("logique")),
    portail: buildPortail(rng.fork("portail")),
  }),
};
