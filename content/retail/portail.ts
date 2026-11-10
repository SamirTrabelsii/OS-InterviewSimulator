import "server-only";
import type { Rng } from "@/engine/rng";
import type { PyTest, Stages } from "@/engine/content/schemas";

export const CANARY = "CANARI-retail-portail-91d4a8";

type Stock = Record<string, number>;

/** Référence : nombre de colis à commander par SKU pour atteindre le seuil. */
export function commandesReassort(stocks: Stock, seuils: Stock, colis: number): Stock {
  const out: Stock = {};
  for (const [sku, seuil] of Object.entries(seuils)) {
    const manque = seuil - (stocks[sku] ?? 0);
    if (manque > 0) out[sku] = Math.ceil(manque / colis);
  }
  return out;
}

const SKUS = ["LUM-001", "LUM-002", "BOU-010", "BOU-011", "TEX-020", "VAI-030", "DEC-040", "DEC-041", "DEC-042"];

function randomCase(rng: Rng): PyTest {
  const seuils: Stock = {};
  const stocks: Stock = {};
  for (const sku of rng.sample(SKUS, rng.int(3, SKUS.length))) {
    seuils[sku] = rng.int(5, 40);
    // Certains SKU n'ont jamais été reçus en boutique : absents des stocks
    if (rng.chance(0.8)) stocks[sku] = rng.int(0, 50);
  }
  const colis = rng.pick([4, 6, 10, 12]);
  return { args: [stocks, seuils, colis], expected: commandesReassort(stocks, seuils, colis) };
}

const BUGGY = `def commandes_reassort(stocks, seuils, colis):
    """Renvoie {sku: nombre de colis à commander} pour que chaque SKU
    atteigne au moins son seuil. Ne lister que les SKU à commander."""
    commandes = {}
    for sku in stocks:
        manque = seuils[sku] - stocks[sku]
        if manque >= 0:
            commandes[sku] = manque // colis
    return commandes
`;

export function buildPortail(rng: Rng): Stages["portail"] {
  const cases = Array.from({ length: 6 }, (_, i) => randomCase(rng.fork(`cas-${i}`)));
  const ex = { stocks: { "LUM-001": 2, "BOU-010": 9 }, seuils: { "LUM-001": 10, "BOU-010": 9 }, colis: 6 };

  return {
    public: {
      title: "Le Portail",
      story:
        "Les 4 gemmes brillent, mais le Portail refuse de s'ouvrir : le script de réassort de 6 h du matin est cassé. " +
        "Si rien n'est corrigé, 40 boutiques ouvriront avec des rayons vides. À deux, trouvez et corrigez les bugs.",
      statement:
        "commandes_reassort(stocks, seuils, colis) doit renvoyer, pour chaque SKU dont le stock est sous son seuil, " +
        "le nombre de colis (de taille colis) à commander pour l'atteindre au moins. Un SKU absent de stocks a un stock de 0.",
      signature: { functionName: "commandes_reassort", params: ["stocks", "seuils", "colis"] },
      buggyCode: BUGGY,
      examples: [
        { args: [ex.stocks, ex.seuils, ex.colis], expected: commandesReassort(ex.stocks, ex.seuils, ex.colis) },
      ],
    },
    private: {
      canary: CANARY,
      fixedSolution: `# ${CANARY}
import math

def commandes_reassort(stocks, seuils, colis):
    commandes = {}
    for sku, seuil in seuils.items():
        manque = seuil - stocks.get(sku, 0)
        if manque > 0:
            commandes[sku] = math.ceil(manque / colis)
    return commandes
`,
      bugs: [
        "Parcourt stocks au lieu de seuils : les SKU jamais reçus (absents de stocks) sont oubliés.",
        "manque >= 0 au lieu de manque > 0 : liste des SKU déjà au seuil avec 0 colis.",
        "Division entière (//) au lieu d'un arrondi supérieur : commande un colis de trop peu.",
      ],
      hiddenTests: [
        { args: [{}, { "TEX-020": 7 }, 6], expected: { "TEX-020": 2 } }, // SKU absent des stocks
        { args: [{ "VAI-030": 12 }, { "VAI-030": 12 }, 4], expected: {} }, // exactement au seuil
        { args: [{ "DEC-040": 0 }, { "DEC-040": 12 }, 6], expected: { "DEC-040": 2 } }, // division exacte
        ...cases,
      ],
    },
  };
}
