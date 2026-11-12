import { describe, expect, it } from "vitest";
import { datasetToSql } from "@/engine/sql/setup";
import { MalformedAnswerError } from "./errors";
import { compareSqlResults, normalizeSqlQuery } from "./sql";

describe("comparaison des résultats SQL", () => {
  const expected = { columns: ["boutique_id", "nom", "valeur_ecart"], rows: [[3, "Lumen Lille", 120.5], [1, "Lumen Arras", 80]] };

  it("même résultat → ok (casse des colonnes et flottants tolérés)", () => {
    const actual = { columns: ["BOUTIQUE_ID", "nom", "Valeur_Ecart"], rows: [[3, "Lumen Lille", 120.50000000001], [1, "Lumen Arras", 80.0]] };
    expect(compareSqlResults(expected, actual, true)).toEqual({ ok: true });
  });

  it("bonnes lignes dans le désordre : refusé si l'énoncé impose l'ordre, accepté sinon", () => {
    const actual = { columns: expected.columns, rows: [...expected.rows].reverse() };
    expect(compareSqlResults(expected, actual, true)).toEqual({ ok: false, reason: "ordre" });
    expect(compareSqlResults(expected, actual, false)).toEqual({ ok: true });
  });

  it("détecte colonnes, nombre de lignes, valeurs et résultat tronqué", () => {
    expect(compareSqlResults(expected, { columns: ["id", "nom", "valeur_ecart"], rows: expected.rows }, true)).toMatchObject({ reason: "colonnes" });
    expect(compareSqlResults(expected, { columns: expected.columns, rows: expected.rows.slice(0, 1) }, true)).toMatchObject({ reason: "lignes" });
    expect(compareSqlResults(expected, { columns: expected.columns, rows: [[3, "Lumen Lille", 120.49], [1, "Lumen Arras", 80]] }, false)).toMatchObject({
      reason: "valeurs",
    });
    expect(compareSqlResults(expected, { ...expected, truncated: true }, true)).toMatchObject({ reason: "tronque" });
  });

  it("une chaîne n'est pas égale au nombre correspondant", () => {
    const actual = { columns: expected.columns, rows: [["3", "Lumen Lille", 120.5], [1, "Lumen Arras", 80]] };
    expect(compareSqlResults(expected, actual, true).ok).toBe(false);
  });
});

describe("requête du candidat", () => {
  it("refuse une requête mal formée", () => {
    for (const bad of ["", "   ", null, 42, { q: "SELECT 1" }, "x".repeat(10_001)]) {
      expect(() => normalizeSqlQuery(bad)).toThrow(MalformedAnswerError);
    }
    expect(normalizeSqlQuery("  SELECT 1;\n")).toBe("SELECT 1;");
  });
});

describe("script de création d'un jeu de données", () => {
  it("échappe les identifiants et les chaînes", () => {
    const sql = datasetToSql({
      tables: [
        {
          name: "t",
          description: "d",
          columns: [
            { name: "a", type: "INTEGER", description: "d" },
            { name: "b", type: "TEXT", description: "d" },
          ],
          rows: [
            [1, "l'arbre"],
            [null, "x"],
          ],
        },
      ],
    });
    expect(sql).toBe(`CREATE TABLE "t" ("a" INTEGER, "b" TEXT);\nINSERT INTO "t" VALUES\n(1, 'l''arbre'),\n(NULL, 'x');`);
  });
});
