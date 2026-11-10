// Schémas du contenu des scénarios.
//
// Chaque épreuve générée pour une graine a deux moitiés :
//   - `public`  : ce que le navigateur du candidat peut recevoir ;
//   - `private` : solutions, tests cachés, jeu de données caché. JAMAIS
//                 envoyé au navigateur (voir docs/ARCHITECTURE.md § 3.4).
//
// Les schémas publics sont stricts : un champ inconnu fait échouer la
// validation, ce qui empêche une donnée privée de s'y glisser par erreur.
import { z } from "zod";

export const STAGE_IDS = ["quiz", "sql", "algo", "logique", "portail"] as const;
export type StageId = (typeof STAGE_IDS)[number];

/** Chaîne témoin, unique par épreuve, présente dans chaque partie privée. */
export const canarySchema = z.string().regex(/^CANARI-[a-z0-9-]+$/);

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9-]+$/);

// ---------------------------------------------------------------- jeux de données

export const sqlColumnSchema = z.strictObject({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  type: z.enum(["INTEGER", "TEXT", "REAL"]),
  description: text,
});

export const sqlCellSchema = z.union([z.string(), z.number(), z.null()]);

export const sqlTableSchema = z
  .strictObject({
    name: z.string().regex(/^[a-z_][a-z0-9_]*$/),
    description: text,
    columns: z.array(sqlColumnSchema).min(1),
    rows: z.array(z.array(sqlCellSchema)),
  })
  .refine((t) => t.rows.every((r) => r.length === t.columns.length), {
    message: "chaque ligne doit avoir autant de valeurs que de colonnes",
  });

export const sqlDatasetSchema = z.strictObject({ tables: z.array(sqlTableSchema).min(1) });

/** Cas de test d'une fonction Python : arguments et résultat en JSON. */
export const pyTestSchema = z.strictObject({ args: z.array(z.json()), expected: z.json() });

const pySignatureSchema = z.strictObject({
  functionName: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  params: z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/)),
});

// ---------------------------------------------------------------- épreuves

const stageHeader = {
  title: text,
  story: text, // texte narratif affiché au candidat
};

export const quizPublicSchema = z.strictObject({
  ...stageHeader,
  questions: z
    .array(
      z.strictObject({
        id,
        prompt: text,
        choices: z.array(z.strictObject({ id, label: text })).min(2),
      }),
    )
    .min(1),
});
export const quizPrivateSchema = z.strictObject({
  canary: canarySchema,
  answers: z.record(z.string(), id), // id question → id du bon choix
});

export const sqlPublicSchema = z.strictObject({
  ...stageHeader,
  task: text,
  expectedColumns: z.array(z.string()).min(1),
  dataset: sqlDatasetSchema,
});
export const sqlPrivateSchema = z.strictObject({
  canary: canarySchema,
  solutionSql: text,
  orderMatters: z.boolean(),
  hiddenDataset: sqlDatasetSchema,
});

export const algoPublicSchema = z.strictObject({
  ...stageHeader,
  statement: text,
  signature: pySignatureSchema,
  starterCode: text,
  examples: z.array(pyTestSchema).min(1),
});
export const algoPrivateSchema = z.strictObject({
  canary: canarySchema,
  referenceSolution: text,
  hiddenTests: z.array(pyTestSchema).min(3),
});

export const logiquePublicSchema = z.strictObject({
  ...stageHeader,
  puzzle: text,
  clues: z.array(text).min(1),
  answerFormat: text, // ex. « 4 chiffres »
  answerPattern: z.string(), // expression régulière de forme, pas la réponse
});
export const logiquePrivateSchema = z.strictObject({
  canary: canarySchema,
  answer: text,
});

export const portailPublicSchema = z.strictObject({
  ...stageHeader,
  statement: text,
  signature: pySignatureSchema,
  buggyCode: text,
  examples: z.array(pyTestSchema).min(1),
});
export const portailPrivateSchema = z.strictObject({
  canary: canarySchema,
  fixedSolution: text,
  bugs: z.array(text).min(1), // pour le recruteur : liste des bugs à trouver
  hiddenTests: z.array(pyTestSchema).min(3),
});

const stage = <P extends z.ZodType, Q extends z.ZodType>(pub: P, priv: Q) =>
  z.strictObject({ public: pub, private: priv });

// ---------------------------------------------------------------- scénario

export const scenarioMetaSchema = z.strictObject({
  id,
  title: text,
  company: text,
  pitch: text, // introduction affichée au démarrage
  epilogue: text, // rapport final affiché au candidat (sans note)
});

export const scenarioInstanceSchema = z.strictObject({
  meta: scenarioMetaSchema,
  stages: z.strictObject({
    quiz: stage(quizPublicSchema, quizPrivateSchema),
    sql: stage(sqlPublicSchema, sqlPrivateSchema),
    algo: stage(algoPublicSchema, algoPrivateSchema),
    logique: stage(logiquePublicSchema, logiquePrivateSchema),
    portail: stage(portailPublicSchema, portailPrivateSchema),
  }),
});

export const publicInstanceSchema = z.strictObject({
  meta: scenarioMetaSchema,
  stages: z.strictObject({
    quiz: quizPublicSchema,
    sql: sqlPublicSchema,
    algo: algoPublicSchema,
    logique: logiquePublicSchema,
    portail: portailPublicSchema,
  }),
});

export type ScenarioMeta = z.infer<typeof scenarioMetaSchema>;
export type ScenarioInstance = z.infer<typeof scenarioInstanceSchema>;
export type PublicInstance = z.infer<typeof publicInstanceSchema>;
export type SqlDataset = z.infer<typeof sqlDatasetSchema>;
export type PyTest = z.infer<typeof pyTestSchema>;
export type Stages = ScenarioInstance["stages"];
