import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "./schema";

// Une seule instance Cloud Run et db-f1-micro (~25 connexions) :
// un petit pool suffit. Mis en cache sur globalThis pour survivre au HMR.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function pool(): Pool {
  if (!globalForDb.pgPool) {
    const p = new Pool({ connectionString: env().DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
    // Sans ce gestionnaire, une connexion inactive coupée par PostgreSQL
    // (redémarrage, arrêt planifié de Cloud SQL) devient une exception non
    // interceptée. Le pool écarte le client fautif et en ouvre un neuf.
    p.on("error", (err) => {
      console.error("[db] connexion inactive perdue:", err.message);
    });
    globalForDb.pgPool = p;
  }
  return globalForDb.pgPool;
}

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function db() {
  cachedDb ??= drizzle(pool(), { schema });
  return cachedDb;
}
