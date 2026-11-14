import { describe, expect, it } from "vitest";
import { grille } from "@content/grille";
import { adequation, evaluate } from "./adequation";
import { grilleSchema } from "./types";

const all = (n: 1 | 2 | 3 | 4) => Object.fromEntries(grille.competences.map((c) => [c.id, n]));

describe("grille (contenu)", () => {
  it("est valide : 10 compétences à 4 niveaux, 4 profils pondérés partout", () => {
    expect(grilleSchema.safeParse(grille).success).toBe(true);
    expect(grille.competences).toHaveLength(10);
    expect(grille.profils.map((p) => p.id)).toEqual(["data-engineer", "bi", "ia", "salesforce"]);
    for (const p of grille.profils) expect(Object.keys(p.poids).sort()).toEqual(grille.competences.map((c) => c.id).sort());
  });
  it("seule l'honnêteté est éliminatoire, sous 2", () => {
    expect(grille.competences.filter((c) => c.eliminatoireSous).map((c) => [c.id, c.eliminatoireSous])).toEqual([["honnetete", 2]]);
  });
  it("refuse un profil incomplet", () => {
    const bad = { ...grille, profils: [{ id: "x", nom: "X", poids: { sql: 1 } }] };
    expect(grilleSchema.safeParse(bad).success).toBe(false);
  });
});

describe("adéquation", () => {
  it("tout à 4 → 100 %, tout à 1 → 25 %", () => {
    for (const p of grille.profils) {
      expect(adequation(p.poids, all(4))).toBe(100);
      expect(adequation(p.poids, all(1))).toBe(25);
    }
  });
  it("exemple calculé à la main", () => {
    // Poids 2, 4, 1 ; notes 4, 2, 3 → (8 + 8 + 3) / (4 × 7) = 19 / 28 = 67,9 → 68 %
    expect(adequation({ a: 2, b: 4, c: 1 }, { a: 4, b: 2, c: 3 })).toBe(68);
  });
  it("retire les « non observé » du numérateur et du dénominateur", () => {
    // b non observé : (4×2 + 3×1) / (4 × 3) = 11 / 12 = 91,7 → 92 %
    expect(adequation({ a: 2, b: 4, c: 1 }, { a: 4, b: null, c: 3 })).toBe(92);
    // une compétence non encore notée se comporte pareil
    expect(adequation({ a: 2, b: 4, c: 1 }, { a: 4, c: 3 })).toBe(92);
  });
  it("rien d'observé → null (pas 0 %)", () => {
    expect(adequation({ a: 1 }, {})).toBeNull();
    expect(adequation({ a: 1 }, { a: null })).toBeNull();
  });
  it("ignore une note hors 1-4", () => {
    expect(adequation({ a: 1, b: 1 }, { a: 4, b: 9 as never })).toBe(100);
  });
  it("le profil le mieux placé reflète les points forts (SQL + client → BI devant IA)", () => {
    const r = evaluate(grille, { ...all(2), sql: 4, client: 4 });
    const pct = Object.fromEntries(r.adequations.map((a) => [a.profil, a.pourcentage!]));
    expect(pct.bi).toBeGreaterThan(pct.ia);
  });
});

describe("éliminatoire", () => {
  it("honnêteté à 1 → non retenu, même avec 100 % ailleurs", () => {
    const r = evaluate(grille, { ...all(4), honnetete: 1 });
    expect(r.nonRetenu).toBe(true);
    expect(r.motifs[0]).toContain("Honnêteté");
    expect(r.adequations.every((a) => a.pourcentage !== null && a.pourcentage > 80)).toBe(true);
  });
  it("honnêteté à 2 (au seuil) → retenu ; non observée → retenu", () => {
    expect(evaluate(grille, { ...all(3), honnetete: 2 }).nonRetenu).toBe(false);
    expect(evaluate(grille, { ...all(3), honnetete: null }).nonRetenu).toBe(false);
  });
  it("une note basse sur une autre compétence n'exclut pas", () => {
    expect(evaluate(grille, { ...all(4), sql: 1 }).nonRetenu).toBe(false);
  });
});
