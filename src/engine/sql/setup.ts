// Script SQLite (CREATE + INSERT) d'un jeu de données de scénario.
// Fonction pure, partagée par le navigateur (sql.js, jeu visible) et le
// serveur (bac à sable et requête solution, jeux visible et caché).
import type { SqlDataset } from "@/engine/content/schemas";

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

function literal(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valeur numérique invalide dans le jeu de données");
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/** Lignes par INSERT : reste loin des limites de SQLite (SQLITE_MAX_COMPOUND_SELECT). */
const CHUNK = 200;

export function datasetToSql(dataset: SqlDataset): string {
  const parts: string[] = [];
  for (const table of dataset.tables) {
    const cols = table.columns.map((c) => `${ident(c.name)} ${c.type}`).join(", ");
    parts.push(`CREATE TABLE ${ident(table.name)} (${cols});`);
    for (let i = 0; i < table.rows.length; i += CHUNK) {
      const values = table.rows
        .slice(i, i + CHUNK)
        .map((row) => `(${row.map(literal).join(", ")})`)
        .join(",\n");
      parts.push(`INSERT INTO ${ident(table.name)} VALUES\n${values};`);
    }
  }
  return parts.join("\n");
}
