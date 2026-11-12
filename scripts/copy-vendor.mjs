// Copie dans public/vendor/ les moteurs exécutés dans le navigateur du
// candidat : Pyodide, sql.js et Monaco. Ils sont servis par l'application,
// jamais par un CDN (versions exactes de package-lock.json).
//
// Lancé automatiquement avant `npm run dev` et `npm run build` ;
// public/vendor/ n'est pas versionné.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "vendor");
const mod = (...p) => path.join(root, "node_modules", ...p);
const version = (pkg) => JSON.parse(readFileSync(mod(pkg, "package.json"), "utf8")).version;

const bundles = [
  {
    name: "pyodide",
    from: mod("pyodide"),
    // Uniquement ce que charge loadPyodide() : aucun paquet supplémentaire.
    files: ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"],
  },
  { name: "sqljs", from: mod("sql.js", "dist"), files: ["sql-wasm.js", "sql-wasm.wasm"], pkg: "sql.js" },
  // Version AMD minifiée : chargée par un <script>, sans passer par le bundler.
  { name: "monaco", from: mod("monaco-editor", "min"), files: ["vs"], pkg: "monaco-editor" },
];

const stamp = path.join(out, "versions.json");
const wanted = Object.fromEntries(bundles.map((b) => [b.name, version(b.pkg ?? b.name)]));
const current = existsSync(stamp) ? readFileSync(stamp, "utf8") : "";

if (current === JSON.stringify(wanted)) {
  console.log("vendor : à jour", wanted);
} else {
  rmSync(out, { recursive: true, force: true });
  for (const b of bundles) {
    const dest = path.join(out, b.name);
    mkdirSync(dest, { recursive: true });
    for (const f of b.files) cpSync(path.join(b.from, f), path.join(dest, f), { recursive: true });
  }
  writeFileSync(stamp, JSON.stringify(wanted));
  console.log("vendor : copié", wanted);
}
