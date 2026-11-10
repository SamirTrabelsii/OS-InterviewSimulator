import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL manquante (voir .env.example)"),
});

let cached: z.infer<typeof schema> | undefined;

/** Variables d'environnement serveur, validées au premier accès. */
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
