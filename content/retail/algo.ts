import "server-only";
import type { Rng } from "@/engine/rng";
import type { PyTest, Stages } from "@/engine/content/schemas";

export const CANARY = "CANARI-retail-algo-c92e51";

type Scan = [minute: number, sku: string];

/**
 * Implémentation de référence en TypeScript : calcule les résultats
 * attendus des tests. Un scan est compté sauf si le même SKU a déjà été
 * compté moins de `k` minutes avant (double bip de la douchette).
 */
export function compterScans(scans: Scan[], k: number): Record<string, number> {
  const lastCounted = new Map<string, number>();
  const counts: Record<string, number> = {};
  for (const [minute, sku] of scans) {
    const last = lastCounted.get(sku);
    if (last !== undefined && minute - last < k) continue;
    lastCounted.set(sku, minute);
    counts[sku] = (counts[sku] ?? 0) + 1;
  }
  return counts;
}

const SKUS = ["LUM-001", "LUM-002", "BOU-010", "BOU-011", "TEX-020", "VAI-030", "DEC-040", "DEC-041"];

function randomScans(rng: Rng, n: number, maxMinute: number, skus: string[]): Scan[] {
  const scans: Scan[] = [];
  for (let i = 0; i < n; i++) scans.push([rng.int(0, maxMinute), rng.pick(skus)]);
  // Doubles bips volontaires
  for (let i = 0; i < Math.ceil(n / 4); i++) {
    const [m, s] = rng.pick(scans);
    scans.push([m + rng.int(0, 2), s]);
  }
  return scans.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
}

const toTest = (scans: Scan[], k: number): PyTest => ({ args: [scans, k], expected: compterScans(scans, k) });

export function buildAlgo(rng: Rng): Stages["algo"] {
  const k = rng.int(2, 5);

  const examples = [
    // k ≥ 2, donc k + 3 > 4 : la liste reste triée
    toTest([[0, "LUM-001"], [1, "LUM-001"], [4, "BOU-010"], [k + 3, "LUM-001"]], k),
    toTest([], k),
  ];

  const hiddenTests: PyTest[] = [
    toTest([[10, "TEX-020"]], k),
    toTest([[0, "VAI-030"], [k - 1, "VAI-030"], [k, "VAI-030"]], k), // limite exacte
    toTest([[0, "DEC-040"], [1, "DEC-040"], [2, "DEC-040"], [3, "DEC-040"]], 1), // k = 1 : tout compte
    toTest([[0, "DEC-041"], [k - 1, "DEC-041"], [2 * k - 2, "DEC-041"]], k), // chaîne : comparer au dernier COMPTÉ
    toTest(randomScans(rng.fork("t1"), 30, 120, SKUS), k),
    toTest(randomScans(rng.fork("t2"), 200, 600, SKUS), k),
    toTest(randomScans(rng.fork("t3"), 2000, 10_000, SKUS), rng.int(2, 10)), // volume
  ];

  return {
    public: {
      title: "Gemme du Code",
      story:
        "Les douchettes de la réserve bipent parfois deux fois sur le même article. Le comptage de minuit est faussé : il faut nettoyer les scans.",
      statement:
        "Écrivez compter_scans(scans, k). scans est une liste de paires [minute, sku] triée par minute croissante. " +
        `Un scan est compté, sauf si le même sku a déjà été compté moins de k minutes avant (écart strictement inférieur à k). ` +
        "Renvoyez un dictionnaire sku → nombre de scans comptés (les sku jamais comptés n'apparaissent pas).",
      signature: { functionName: "compter_scans", params: ["scans", "k"] },
      starterCode: "def compter_scans(scans, k):\n    # À vous de jouer\n    return {}\n",
      examples,
    },
    private: {
      canary: CANARY,
      referenceSolution: `# ${CANARY}
def compter_scans(scans, k):
    dernier = {}
    comptes = {}
    for minute, sku in scans:
        if sku in dernier and minute - dernier[sku] < k:
            continue
        dernier[sku] = minute
        comptes[sku] = comptes.get(sku, 0) + 1
    return comptes
`,
      hiddenTests,
    },
  };
}
