// Forme de la grille de compétences (contenu : /content/grille).
import { z } from "zod";

const text = z.string().trim().min(1);

export const competenceSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+$/),
  nom: text,
  /** Où l'observer dans le replay / au débrief. */
  observer: text,
  /** Descripteurs des niveaux 1 à 4, dans l'ordre. */
  niveaux: z.tuple([text, text, text, text]),
  /** Si présent : une note strictement sous ce seuil exclut le candidat, quel que soit son profil. */
  eliminatoireSous: z.number().int().min(2).max(4).optional(),
});

export const profilSchema = z.strictObject({
  id: z.string().regex(/^[a-z-]+$/),
  nom: text,
  /** compétence -> poids de 1 à 4 */
  poids: z.record(z.string(), z.number().int().min(1).max(4)),
});

export const grilleSchema = z
  .strictObject({
    competences: z.array(competenceSchema).min(1),
    profils: z.array(profilSchema).min(1),
  })
  .superRefine((g, ctx) => {
    const ids = g.competences.map((c) => c.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "identifiants de compétence en double" });
    for (const p of g.profils) {
      const keys = Object.keys(p.poids).sort();
      if (keys.join() !== [...ids].sort().join()) {
        ctx.addIssue({ code: "custom", message: `le profil ${p.id} doit avoir un poids pour chaque compétence, et seulement celles-là` });
      }
    }
  });

export type Competence = z.infer<typeof competenceSchema>;
export type Profil = z.infer<typeof profilSchema>;
export type Grille = z.infer<typeof grilleSchema>;

/** Note d'une compétence : 1 à 4, ou null = « non observé ». Absente = pas encore notée. */
export type Note = 1 | 2 | 3 | 4 | null;
export type Notes = Record<string, Note>;
