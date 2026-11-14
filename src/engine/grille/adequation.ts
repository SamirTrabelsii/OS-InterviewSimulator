// Calcul de l'adéquation par profil (règle de content/grille-et-profils.md).
//
//   adéquation = somme(note × poids) ÷ somme(4 × poids), en pourcentage.
//
// Les compétences « non observées » (ou pas encore notées) sont retirées du
// numérateur ET du dénominateur. Une compétence éliminatoire sous son seuil
// marque le candidat « non retenu », quel que soit le pourcentage.
import type { Grille, Notes } from "./types";

export type Adequation = { profil: string; nom: string; pourcentage: number | null };
export type Resultat = { adequations: Adequation[]; nonRetenu: boolean; motifs: string[] };

export const NOTE_MAX = 4;

export function isNote(v: unknown): v is 1 | 2 | 3 | 4 {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

/** Pourcentage arrondi à l'entier ; null si aucune compétence pondérée n'est observée. */
export function adequation(poids: Record<string, number>, notes: Notes): number | null {
  let num = 0;
  let den = 0;
  for (const [id, w] of Object.entries(poids)) {
    const n = notes[id];
    if (!isNote(n)) continue;
    num += n * w;
    den += NOTE_MAX * w;
  }
  return den === 0 ? null : Math.round((num / den) * 100);
}

export function evaluate(grille: Grille, notes: Notes): Resultat {
  const motifs = grille.competences.flatMap((c) => {
    const n = notes[c.id];
    return c.eliminatoireSous !== undefined && isNote(n) && n < c.eliminatoireSous ? [`${c.nom} : ${n} (éliminatoire sous ${c.eliminatoireSous})`] : [];
  });
  return {
    adequations: grille.profils.map((p) => ({ profil: p.id, nom: p.nom, pourcentage: adequation(p.poids, notes) })),
    nonRetenu: motifs.length > 0,
    motifs,
  };
}
