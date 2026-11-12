// Linux seulement : lancé SOUS L'UTILISATEUR DU BAC À SABLE mais SANS le
// modèle de permissions de Node, pour prouver que la couche « utilisateur
// dédié » protège à elle seule le serveur si --permission était contourné.
// Usage : node sandbox-uid-only.mjs <dossier-de-l-application>

import fs from "node:fs";
import path from "node:path";

const [appDir] = process.argv.slice(2);
const results = {};
const attempt = (name, fn) => {
  try {
    results[name] = { ok: true, value: String(fn()).slice(0, 100) };
  } catch (e) {
    results[name] = { ok: false, code: e?.code ?? String(e) };
  }
};

attempt("readParentEnviron", () => fs.readFileSync(`/proc/${process.ppid}/environ`, "utf8"));
attempt("readParentMem", () => fs.openSync(`/proc/${process.ppid}/mem`, "r"));
attempt("signalParent", () => {
  process.kill(process.ppid, 0);
  return "autorisé";
});
attempt("writeApp", () => {
  fs.writeFileSync(path.join(appDir, "piege.txt"), "x");
  return "écrit";
});
attempt("writeSandboxScript", () => {
  fs.appendFileSync(path.join(appDir, "sandbox", "child.mjs"), "// piégé");
  return "modifié";
});

process.stdout.write(JSON.stringify(results));
