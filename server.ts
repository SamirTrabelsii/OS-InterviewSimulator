// Point d'entrée du serveur : HTTP + Next.js.
// Socket.IO viendra s'attacher à `httpServer` à l'étape 8 (voir docs/ROADMAP.md).
// Ce fichier n'est pas compilé par Next : il est lancé par tsx en dev et
// empaqueté par esbuild (dist/server.cjs) pour la production.
import { createServer } from "node:http";
import next from "next";
import { getSandbox } from "./src/server/sandbox/pool";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

async function main() {
  const httpServer = createServer();
  const app = next({ dev, hostname, port, httpServer });
  const handle = app.getRequestHandler();
  await app.prepare();

  httpServer.on("request", (req, res) => {
    void handle(req, res);
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Portail prêt sur http://localhost:${port} (${dev ? "dev" : "production"})`);
    // Un processus du bac à sable préchargé (Pyodide), prêt pour la 1re soumission.
    getSandbox().prewarm();
  });

  // Cloud Run envoie SIGTERM avant d'arrêter l'instance.
  const shutdown = () => {
    getSandbox().close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Échec du démarrage du serveur", err);
  process.exit(1);
});
