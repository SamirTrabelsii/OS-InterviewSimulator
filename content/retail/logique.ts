import "server-only";
import type { Rng } from "@/engine/rng";
import type { Stages } from "@/engine/content/schemas";

export const CANARY = "CANARI-retail-logique-e07b3f";

// Énigme « cadenas » : code de 4 chiffres tous différents, retrouvé à
// partir d'essais notés (bien placés / mal placés). Le générateur ajoute
// des indices jusqu'à ce qu'il ne reste qu'UNE solution possible.

const ALL_CODES: string[] = [];
for (let n = 0; n <= 9999; n++) {
  const s = String(n).padStart(4, "0");
  if (new Set(s).size === 4) ALL_CODES.push(s);
}

export type Clue = { guess: string; placed: number; misplaced: number };

export function score(secret: string, guess: string): { placed: number; misplaced: number } {
  let placed = 0;
  let common = 0;
  for (let i = 0; i < 4; i++) {
    if (secret[i] === guess[i]) placed++;
    if (secret.includes(guess[i])) common++;
  }
  return { placed, misplaced: common - placed };
}

/** Codes compatibles avec tous les indices (exporté pour les tests). */
export function candidates(clues: Clue[]): string[] {
  return ALL_CODES.filter((c) =>
    clues.every((cl) => {
      const s = score(c, cl.guess);
      return s.placed === cl.placed && s.misplaced === cl.misplaced;
    }),
  );
}

const MAX_CLUES = 10;

function generate(rng: Rng): { secret: string; clues: Clue[] } {
  const secret = rng.pick(ALL_CODES);
  const clues: Clue[] = [];
  let remaining = ALL_CODES;
  while (remaining.length > 1) {
    if (clues.length >= MAX_CLUES) throw new Error("Énigme logique : trop d'indices nécessaires");
    // Meilleur de 40 essais aléatoires : celui qui élimine le plus de codes.
    // On n'affiche jamais un essai qui donnerait la réponse directement.
    let best: { clue: Clue; left: string[] } | undefined;
    for (let i = 0; i < 40; i++) {
      const guess = rng.pick(ALL_CODES);
      const s = score(secret, guess);
      if (s.placed === 4 || clues.some((c) => c.guess === guess)) continue;
      const clue = { guess, ...s };
      const left = remaining.filter((c) => {
        const t = score(c, guess);
        return t.placed === s.placed && t.misplaced === s.misplaced;
      });
      if (!best || left.length < best.left.length) best = { clue, left };
    }
    if (!best) continue;
    clues.push(best.clue);
    remaining = best.left;
  }
  return { secret, clues };
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

export function buildLogique(rng: Rng): Stages["logique"] {
  const { secret, clues } = generate(rng);
  return {
    public: {
      title: "Gemme de l'Esprit",
      story:
        "La réserve est fermée par un cadenas à 4 chiffres. Le gardien de nuit a noté ses essais avant de partir… sans noter le bon code.",
      puzzle:
        "Le code compte 4 chiffres, tous différents. Pour chaque essai, « bien placé » = bon chiffre à la bonne position, " +
        "« mal placé » = chiffre présent dans le code mais à une autre position. Un seul code est compatible avec tous les essais.",
      clues: clues.map(
        (c) => `${c.guess} → ${plural(c.placed, "bien placé")}, ${plural(c.misplaced, "mal placé")}`,
      ),
      answerFormat: "4 chiffres",
      answerPattern: "^[0-9]{4}$",
    },
    private: { canary: CANARY, answer: secret },
  };
}
