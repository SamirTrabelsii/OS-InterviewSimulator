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

/** Réplique TypeScript du script cassé : sert à écrire des logs fidèles au bug. */
function commandesCassees(stocks: Stock, seuils: Stock, colis: number): Stock {
  const out: Stock = {};
  for (const sku of Object.keys(stocks)) {
    const manque = seuils[sku] - stocks[sku];
    if (manque >= 0) out[sku] = Math.floor(manque / colis);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Journal de 6 h du matin (vue du copilote). Il montre les symptômes de
 * chaque bug sans jamais citer le code ni la correction.
 */
function morningLogs(rng: Rng): string[] {
  const [absent, pile, reste, ...autres] = rng.sample(SKUS, 5);
  const colis = rng.pick([4, 6, 10, 12]);
  const seuils: Stock = {};
  const stocks: Stock = {};
  seuils[absent] = rng.int(7, 30); // jamais reçu en boutique : absent de stocks
  seuils[pile] = rng.int(8, 25);
  stocks[pile] = seuils[pile]; // exactement au seuil
  seuils[reste] = rng.int(20, 40);
  stocks[reste] = seuils[reste] - (colis + rng.int(1, colis - 1)); // manque non multiple du colis
  for (const sku of autres) {
    seuils[sku] = rng.int(5, 30);
    stocks[sku] = seuils[sku] + rng.int(0, 10);
  }
  const commandes = commandesCassees(stocks, seuils, colis);
  const lignes = Object.entries(commandes);
  const manquants = Object.keys(seuils).filter((sku) => seuils[sku] > (stocks[sku] ?? 0) && !(sku in commandes));
  const sousSeuil = Object.entries(commandes).filter(([sku, n]) => n * colis + (stocks[sku] ?? 0) < seuils[sku]);

  const t = (sec: number) => `06:00:${pad(sec)}`;
  const out = [
    `${t(1)} INFO  reassort.py v2.3 — boutique BTQ-017, colis de ${colis}`,
    `${t(1)} INFO  seuils chargés : ${Object.keys(seuils).length} SKU · stocks reçus : ${Object.keys(stocks).length} SKU`,
    `${t(2)} INFO  commandes générées : ${lignes.length} ligne(s)`,
  ];
  for (const [sku, n] of lignes) {
    if (n === 0) out.push(`${t(2)} WARN  ${sku} : ligne à 0 colis (stock ${stocks[sku]}, seuil ${seuils[sku]})`);
  }
  for (const [sku] of sousSeuil) {
    const n = commandes[sku];
    out.push(
      `${t(3)} WARN  ${sku} : ${n} colis commandé(s) = ${n * colis} unités ; stock ${stocks[sku]} + ${n * colis} = ${stocks[sku] + n * colis} < seuil ${seuils[sku]}`,
    );
  }
  for (const sku of manquants) out.push(`${t(3)} ERROR ${sku} : présent dans le fichier des seuils, absent de la commande`);
  out.push(`${t(4)} INFO  envoi vers l'ERP : ${lignes.length} ligne(s)`);
  out.push(`${t(5)} ERROR ouverture BTQ-017 : rayons incomplets signalés par le magasin`);
  return out;
}

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
      logs: morningLogs(rng.fork("logs")),
      clientContext:
        "Ticket #4821 — Direction des opérations, Maison Lumen. « Ce matin, à 6 h, le script de réassort est parti avec des " +
        "commandes fausses : certaines boutiques n'ont rien reçu pour des articles pourtant sous leur seuil, d'autres ont reçu " +
        "des lignes vides. Les 40 boutiques ouvrent à 9 h. Il nous faut une version corrigée avant 8 h 30. Règle métier : on " +
        "commande des colis entiers, et le stock après livraison doit atteindre le seuil au minimum. »",
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
