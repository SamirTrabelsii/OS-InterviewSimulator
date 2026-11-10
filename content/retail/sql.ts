import "server-only";
import type { Rng } from "@/engine/rng";
import type { SqlDataset, Stages } from "@/engine/content/schemas";

export const CANARY = "CANARI-retail-sql-7f3a2d";

const REGIONS = ["Nord", "Sud", "Est", "Ouest", "Centre"] as const;
const VILLES: Record<(typeof REGIONS)[number], string[]> = {
  Nord: ["Lille", "Amiens", "Rouen", "Arras", "Calais", "Dunkerque", "Lens", "Douai"],
  Sud: ["Marseille", "Nice", "Toulouse", "Montpellier", "Perpignan", "Toulon", "Nîmes", "Avignon"],
  Est: ["Strasbourg", "Metz", "Nancy", "Reims", "Mulhouse", "Colmar", "Besançon", "Dijon"],
  Ouest: ["Nantes", "Rennes", "Brest", "Angers", "Le Mans", "Vannes", "Lorient", "Quimper"],
  Centre: ["Orléans", "Tours", "Bourges", "Blois", "Chartres", "Limoges", "Vichy", "Nevers"],
};
const CATEGORIES = ["Luminaires", "Bougies", "Textile", "Vaisselle", "Décoration"] as const;
const PRODUITS = [
  "Lampe Opale", "Suspension Iris", "Applique Nova", "Lampadaire Arc", "Veilleuse Lune",
  "Bougie Ambre", "Bougie Figue", "Photophore Givre", "Coffret Trois Mèches", "Diffuseur Cèdre",
  "Plaid Laine", "Coussin Lin", "Rideau Voile", "Tapis Jute", "Nappe Coton",
  "Assiette Grès", "Bol Céladon", "Tasse Émail", "Carafe Verre", "Plateau Chêne",
  "Vase Terre", "Miroir Soleil", "Cadre Laiton", "Horloge Murale", "Panier Osier",
];

/** 40 boutiques (8 par région), 25 produits, inventaire complet. */
function generate(rng: Rng): SqlDataset {
  const boutiques: (string | number)[][] = [];
  let id = 1;
  for (const region of REGIONS) {
    for (const ville of rng.shuffle(VILLES[region])) {
      boutiques.push([id++, `Lumen ${ville}`, ville, region]);
    }
  }

  const produits = PRODUITS.map((nom, i) => [
    i + 1,
    nom,
    CATEGORIES[Math.floor(i / 5)],
    rng.int(5, 120) * 100 - rng.pick([0, 1, 10, 51]), // prix en centimes
  ]);

  const inventaire: number[][] = [];
  for (const [boutiqueId] of boutiques) {
    for (const [produitId] of produits) {
      const theorique = rng.int(0, 60);
      // ~20 % de lignes avec un écart, parfois important (casse, vol, erreur de saisie)
      const ecart = rng.chance(0.2) ? rng.pick([-1, 1]) * rng.int(1, rng.chance(0.1) ? 25 : 5) : 0;
      inventaire.push([boutiqueId as number, produitId as number, theorique, Math.max(0, theorique + ecart)]);
    }
  }

  return {
    tables: [
      {
        name: "boutiques",
        description: "Les 40 boutiques Maison Lumen.",
        columns: [
          { name: "id", type: "INTEGER", description: "Identifiant de la boutique" },
          { name: "nom", type: "TEXT", description: "Nom de la boutique" },
          { name: "ville", type: "TEXT", description: "Ville" },
          { name: "region", type: "TEXT", description: "Région commerciale" },
        ],
        rows: boutiques,
      },
      {
        name: "produits",
        description: "Catalogue.",
        columns: [
          { name: "id", type: "INTEGER", description: "Identifiant du produit" },
          { name: "nom", type: "TEXT", description: "Nom du produit" },
          { name: "categorie", type: "TEXT", description: "Catégorie" },
          { name: "prix_cents", type: "INTEGER", description: "Prix de vente en centimes" },
        ],
        rows: produits,
      },
      {
        name: "inventaire",
        description: "Comptage de minuit : stock attendu par le système et stock réellement compté.",
        columns: [
          { name: "boutique_id", type: "INTEGER", description: "→ boutiques.id" },
          { name: "produit_id", type: "INTEGER", description: "→ produits.id" },
          { name: "stock_theorique", type: "INTEGER", description: "Quantité attendue" },
          { name: "stock_compte", type: "INTEGER", description: "Quantité comptée cette nuit" },
        ],
        rows: inventaire,
      },
    ],
  };
}

export function buildSql(rng: Rng): Stages["sql"] {
  const region = rng.pick(REGIONS);
  const top = rng.pick([3, 5]);

  return {
    public: {
      title: "Gemme des Données",
      story:
        "Le comptage de minuit est terminé, mais les chiffres ne collent pas. La direction veut savoir où regarder en premier.",
      task:
        `Pour la région ${region}, donnez les ${top} boutiques dont la valeur des écarts d'inventaire est la plus élevée. ` +
        "La valeur d'écart d'une boutique est la somme, sur tous ses produits, de |stock compté − stock théorique| × prix, en euros arrondis à 2 décimales. " +
        "Triez par valeur décroissante, puis par identifiant croissant en cas d'égalité.",
      expectedColumns: ["boutique_id", "nom", "valeur_ecart"],
      dataset: generate(rng.fork("visible")),
    },
    private: {
      canary: CANARY,
      solutionSql: `-- ${CANARY}
SELECT b.id AS boutique_id,
       b.nom,
       ROUND(SUM(ABS(i.stock_compte - i.stock_theorique) * p.prix_cents) / 100.0, 2) AS valeur_ecart
FROM boutiques b
JOIN inventaire i ON i.boutique_id = b.id
JOIN produits p ON p.id = i.produit_id
WHERE b.region = '${region}'
GROUP BY b.id, b.nom
ORDER BY valeur_ecart DESC, b.id ASC
LIMIT ${top};`,
      orderMatters: true,
      hiddenDataset: generate(rng.fork("cache")),
    },
  };
}
