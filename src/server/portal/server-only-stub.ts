// server.ts tourne hors de Next : le paquet `server-only` (qui sert de
// garde-fou au build Next) y lèverait une erreur dès l'import. On le
// remplace par un module vide POUR CE PROCESSUS. Le garde-fou du build
// (composants clients) et le test de canaris ne changent pas.
// À importer en tout premier dans server.ts.
import Module from "node:module";
import path from "node:path";

type Resolver = (request: string, ...rest: unknown[]) => string;
const m = Module as unknown as { _resolveFilename: Resolver };
const original = m._resolveFilename;
const empty = path.join(path.dirname(require.resolve("server-only")), "empty.js");
m._resolveFilename = function (request: string, ...rest: unknown[]) {
  return request === "server-only" ? empty : original.call(this, request, ...rest);
};
