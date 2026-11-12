// Tests communs à TOUS les scénarios du registre : un nouveau scénario
// est couvert automatiquement dès qu'il est ajouté à content/index.ts.
import { describe, expect, it } from "vitest";
import { buildInstance, toPublic } from "@/engine/content/instance";
import { STAGE_IDS } from "@/engine/content/schemas";
import { scenarios } from "./index";
import { candidates, type Clue } from "./retail/logique";

const SEEDS = Array.from({ length: 60 }, (_, i) => BigInt(i * 7919 + 1));
const PRIVATE_KEYS = ["canary", "answers", "solutionSql", "hiddenDataset", "referenceSolution", "hiddenTests", "answer", "fixedSolution", "bugs"];

describe.each(scenarios.map((s) => [s.meta.id, s] as const))("scénario %s", (_id, def) => {
  // Générées une seule fois : buildInstance valide déjà Zod et les canaris.
  let instances: ReturnType<typeof buildInstance>[] = [];

  // 60 graines : 2,5 à 9 s selon la charge de la machine → délai explicite.
  it("chaque graine produit une instance valide (Zod + canaris)", { timeout: 30_000 }, () => {
    instances = SEEDS.map((seed) => buildInstance(def, seed));
    expect(instances).toHaveLength(SEEDS.length);
  });

  it("est déterministe : même graine → même instance", () => {
    expect(buildInstance(def, 123n)).toEqual(buildInstance(def, 123n));
  });

  it("varie avec la graine", () => {
    const sqlTasks = new Set(instances.map((i) => i.stages.sql.public.task));
    const answers = new Set(instances.map((i) => i.stages.logique.private.answer));
    expect(sqlTasks.size).toBeGreaterThan(1);
    expect(answers.size).toBeGreaterThan(SEEDS.length / 2);
    expect(instances[0]).not.toEqual(instances[1]);
  });

  it("le jeu de données caché diffère du jeu visible", () => {
    const sql = buildInstance(def, 99n).stages.sql;
    expect(sql.private.hiddenDataset).not.toEqual(sql.public.dataset);
  });

  it("chaque solution contient le canari de son épreuve", () => {
    const st = buildInstance(def, 5n).stages;
    expect(st.sql.private.solutionSql).toContain(def.canaries.sql);
    expect(st.algo.private.referenceSolution).toContain(def.canaries.algo);
    expect(st.portail.private.fixedSolution).toContain(def.canaries.portail);
    expect(new Set(Object.values(def.canaries)).size).toBe(STAGE_IDS.length);
  });

  it("toPublic() ne laisse passer aucune donnée privée", () => {
    for (const instance of instances.slice(0, 15)) {
      const json = JSON.stringify(toPublic(instance));
      for (const canary of Object.values(def.canaries)) expect(json).not.toContain(canary);
      for (const key of PRIVATE_KEYS) expect(json).not.toContain(`"${key}"`);
    }
  });

  it("toPublic() refuse une partie publique qui contiendrait un champ en trop", () => {
    const instance = buildInstance(def, 1n);
    (instance.stages.algo.public as Record<string, unknown>).solution = "fuite";
    expect(() => toPublic(instance)).toThrow();
  });

  it("le quiz a exactement une bonne réponse existante par question", () => {
    const quiz = buildInstance(def, 8n).stages.quiz;
    for (const q of quiz.public.questions) {
      expect(q.choices.map((c) => c.id)).toContain(quiz.private.answers[q.id]);
    }
    expect(Object.keys(quiz.private.answers).sort()).toEqual(quiz.public.questions.map((q) => q.id).sort());
  });
});

describe("retail / énigme logique", () => {
  const retail = scenarios.find((s) => s.meta.id === "retail")!;
  const parse = (line: string): Clue => {
    const m = /^(\d{4}) → (\d) bien placés?, (\d) mal placés?$/.exec(line);
    if (!m) throw new Error(`indice illisible : ${line}`);
    return { guess: m[1], placed: Number(m[2]), misplaced: Number(m[3]) };
  };

  it("les indices affichés admettent une seule solution : la bonne", { timeout: 20_000 }, () => {
    for (const seed of SEEDS) {
      const { public: pub, private: priv } = buildInstance(retail, seed).stages.logique;
      expect(candidates(pub.clues.map(parse))).toEqual([priv.answer]);
    }
  });
});
