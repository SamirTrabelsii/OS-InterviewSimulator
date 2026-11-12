import "server-only";
import { createRequire } from "node:module";
import path from "node:path";
import type { SqlTable } from "@/engine/validators/sql";

// Exécute les requêtes SOLUTION (code de confiance, écrit par nous) dans le
// processus serveur, avec sql.js. Le code des candidats, lui, ne passe
// jamais ici : il va dans le bac à sable (src/server/sandbox).
// Ainsi l'enfant du bac à sable ne reçoit jamais la solution ni ses
// résultats (docs/ARCHITECTURE.md § 3.5).

type Statement = { getColumnNames(): string[]; step(): boolean; get(): unknown[]; free(): void };
type Database = { exec(sql: string): unknown; prepare(sql: string): Statement; close(): void };
type SqlJs = { Database: new () => Database };

let engine: Promise<SqlJs> | null = null;

function loadEngine(): Promise<SqlJs> {
  // Chargé à l'exécution depuis node_modules (comme le bac à sable), pas
  // empaqueté par Next.
  const dir = path.join(process.cwd(), "node_modules", "sql.js", "dist");
  const initSqlJs = createRequire(path.join(dir, "noop.js"))(path.join(dir, "sql-wasm.js")) as (o: object) => Promise<SqlJs>;
  engine ??= initSqlJs({ locateFile: (file: string) => path.join(dir, file) });
  return engine;
}

export async function runReferenceSql(setup: string, query: string): Promise<SqlTable> {
  const SQL = await loadEngine();
  const db = new SQL.Database();
  try {
    db.exec(setup);
    const stmt = db.prepare(query);
    const columns = stmt.getColumnNames();
    const rows: unknown[][] = [];
    while (stmt.step()) rows.push(stmt.get());
    stmt.free();
    return { columns, rows };
  } finally {
    db.close();
  }
}
