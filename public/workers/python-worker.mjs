// Exécution Python dans le navigateur du candidat (Pyodide, servi par
// l'application depuis /vendor/pyodide, jamais par un CDN). Web Worker de
// type module : une boucle infinie ne fige pas la page, le worker est
// arrêté puis recréé. Seuls les exemples PUBLICS arrivent ici ; les tests
// cachés sont exécutés sur le serveur.
import { loadPyodide } from "/vendor/pyodide/pyodide.mjs";

const BASE = new URL("/vendor/pyodide/", self.location.origin).href;
const OUTPUT_LIMIT = 8_000;

let out = "";
const capture = (text) => {
  if (out.length < OUTPUT_LIMIT) out += text + "\n";
};

const pyodide = await loadPyodide({
  indexURL: BASE,
  // Tout est local : sans packageBaseUrl, Pyodide irait chercher les
  // paquets manquants sur son CDN.
  packageBaseUrl: BASE,
  lockFileURL: `${BASE}pyodide-lock.json`,
  stdout: capture,
  stderr: capture,
});

const call = pyodide.runPython(`
import json as _json

def _call(code, fn, args_json):
    ns = {"__name__": "__main__"}
    try:
        exec(compile(code, "<candidat>", "exec"), ns)
    except BaseException as e:
        return _json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"[:500]})
    f = ns.get(fn)
    if not callable(f):
        return _json.dumps({"ok": False, "error": f"Fonction « {fn} » introuvable"})
    try:
        value = f(*_json.loads(args_json))
    except BaseException as e:
        return _json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"[:500]})
    try:
        return _json.dumps({"ok": True, "value": value})
    except BaseException:
        return _json.dumps({"ok": False, "error": "Valeur de retour non sérialisable en JSON"})

_call
`);

self.onmessage = (event) => {
  const { id, code, fn, cases } = event.data;
  const results = cases.map((args) => {
    out = "";
    const started = performance.now();
    const r = JSON.parse(call(code, fn, JSON.stringify(args)));
    return { ...r, output: out.slice(0, OUTPUT_LIMIT), durationMs: Math.round(performance.now() - started) };
  });
  self.postMessage({ type: "result", id, results });
};

self.postMessage({ type: "ready" });
