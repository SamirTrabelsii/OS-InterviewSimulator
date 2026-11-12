// Processus enfant du bac à sable (voir src/server/sandbox/pool.ts et
// docs/ARCHITECTURE.md § 3.5). Exécute UNE tâche puis se termine.
//
// Lancé par le parent avec : env vide, --permission (lecture limitée aux
// fichiers Pyodide / sql.js et à ce script, ni écriture, ni réseau, ni
// processus, ni workers), --disallow-code-generation-from-strings et un tas
// JS plafonné. Ces drapeaux sont la vraie frontière ; ce qui suit n'est
// qu'une défense en profondeur.
//
// Protocole (JSON par lignes) :
//   enfant → parent : {"type":"ready"}
//   parent → enfant : une tâche (voir src/server/sandbox/protocol.ts)
//   enfant → parent : {"type":"case",...}* puis {"type":"done",...}
//
// Fichier JavaScript pur : il est lancé directement par `node`, sans tsx ni
// esbuild, et doit exister tel quel dans l'image de production.

import { constants as fsConstants } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// ---------------------------------------------------------------------------
// 1. Références capturées avant tout nettoyage
// ---------------------------------------------------------------------------
const stdout = process.stdout;
const stdin = process.stdin;
const exit = process.exit.bind(process);
const [pyodideDir, sqljsDir] = process.argv.slice(2);
const MEMORY_LIMIT = Number(process.argv[4]) || 256 * 1024 * 1024;
const STDOUT_LIMIT = Number(process.argv[5]) || 64 * 1024;
const MAX_ROWS_HARD = 5000;

const send = (msg) => stdout.write(JSON.stringify(msg) + "\n");

// ---------------------------------------------------------------------------
// 2. Plafond mémoire WASM : Pyodide et sql.js grandissent leur mémoire via
//    `WebAssembly.Memory.prototype.grow` (emscripten). Au-delà du plafond,
//    l'allocation échoue → `MemoryError` Python / SQLITE_NOMEM, proprement.
// ---------------------------------------------------------------------------
const originalGrow = WebAssembly.Memory.prototype.grow;
Object.defineProperty(WebAssembly.Memory.prototype, "grow", {
  value: function grow(deltaPages) {
    if (this.buffer.byteLength + deltaPages * 65536 > MEMORY_LIMIT) {
      throw new RangeError("Limite mémoire du bac à sable atteinte");
    }
    return originalGrow.call(this, deltaPages);
  },
  writable: false,
  configurable: false,
});

// ---------------------------------------------------------------------------
// 3. Pyodide lit `process.binding("constants")` au chargement ; le modèle de
//    permissions interdit `process.binding`. On ne fournit que les constantes.
// ---------------------------------------------------------------------------
process.binding = (name) => {
  if (name === "constants") return { fs: fsConstants };
  throw new Error("process.binding interdit");
};

// ---------------------------------------------------------------------------
// 4. Plus d'API réseau dans le contexte global (le réseau est de toute façon
//    refusé par le modèle de permissions).
// ---------------------------------------------------------------------------
for (const name of ["fetch", "WebSocket", "XMLHttpRequest", "EventSource", "Request", "Response", "Headers"]) {
  try {
    delete globalThis[name];
  } catch {
    /* ignoré */
  }
}

// ---------------------------------------------------------------------------
// 5. Chargement des moteurs
// ---------------------------------------------------------------------------
let pyOut = "";
let pyOutTruncated = false;
const capture = (text) => {
  if (pyOutTruncated) return;
  const room = STDOUT_LIMIT - pyOut.length;
  if (text.length + 1 > room) {
    pyOut += (text + "\n").slice(0, Math.max(0, room));
    pyOutTruncated = true;
  } else {
    pyOut += text + "\n";
  }
};

const { loadPyodide } = await import(pathToFileURL(`${pyodideDir}/pyodide.mjs`).href);
// Tout est local : sans `packageBaseUrl`, Pyodide télécharge les paquets
// manquants depuis cdn.jsdelivr.net (et le réseau est de toute façon refusé).
const localBase = pathToFileURL(`${pyodideDir}/`).href;
const pyodide = await loadPyodide({
  indexURL: pyodideDir,
  packageBaseUrl: localBase,
  packageCacheDir: pyodideDir,
  lockFileURL: `${pyodideDir}/pyodide-lock.json`,
  // `import js` ne donne accès qu'à un objet vide.
  jsglobals: Object.create(null),
  env: {},
  stdout: capture,
  stderr: capture,
  stdin: () => null,
});

const initSqlJs = createRequire(import.meta.url)(`${sqljsDir}/sql-wasm.js`);
const SQL = await initSqlJs({ locateFile: (file) => `${sqljsDir}/${file}` });

// Défense en profondeur côté Python : retire les modules passerelles vers JS
// ou le réseau. Ce n'est PAS une frontière (Pyodide offre d'autres chemins
// vers JS) : la frontière est le modèle de permissions de Node.
pyodide.runPython(`
import os, sys
for _k in ("_", "PYTHONINSPECT"):
    os.environ.pop(_k, None)

_BLOCKED = ("pyodide_js", "pyodide.http", "pyodide.code", "micropip", "pyodide_http")

class _Blocker:
    def find_spec(self, name, path=None, target=None):
        if name in _BLOCKED or name.startswith("micropip."):
            raise ImportError(f"module « {name} » indisponible dans le bac à sable")
        return None

for _m in list(sys.modules):
    if _m in _BLOCKED:
        del sys.modules[_m]
sys.meta_path.insert(0, _Blocker())
del _Blocker, _m, _k, os, sys
`);

const HARNESS = pyodide.runPython(`
import json as _json, traceback as _tb

def _sandbox_compile(code):
    return compile(code, "<candidat>", "exec")

def _sandbox_fresh_ns():
    return {"__name__": "__main__", "__builtins__": __builtins__}

def _sandbox_error(e):
    return f"{type(e).__name__}: {e}"[:500]

def _sandbox_call(compiled, fn, args_json):
    ns = _sandbox_fresh_ns()
    try:
        exec(compiled, ns)
    except BaseException as e:
        return _json.dumps({"ok": False, "error": _sandbox_error(e)})
    f = ns.get(fn)
    if not callable(f):
        return _json.dumps({"ok": False, "error": f"Fonction « {fn} » introuvable"})
    try:
        value = f(*_json.loads(args_json))
    except BaseException as e:
        return _json.dumps({"ok": False, "error": _sandbox_error(e)})
    try:
        return _json.dumps({"ok": True, "value": value})
    except BaseException:
        return _json.dumps({"ok": False, "error": "Valeur de retour non sérialisable en JSON"})

def _sandbox_script(compiled):
    try:
        exec(compiled, _sandbox_fresh_ns())
        return None
    except BaseException as e:
        return _sandbox_error(e)

{"compile": _sandbox_compile, "call": _sandbox_call, "script": _sandbox_script, "error": _sandbox_error}
`);
const py = {
  compile: HARNESS.get("compile"),
  call: HARNESS.get("call"),
  script: HARNESS.get("script"),
  error: HARNESS.get("error"),
};

// ---------------------------------------------------------------------------
// 6. Neutralise ce qu'un code évadé vers JS pourrait utiliser contre le
//    parent (process.kill n'est pas couvert par le modèle de permissions).
// ---------------------------------------------------------------------------
const deny = () => {
  throw new Error("Interdit dans le bac à sable");
};
for (const name of ["kill", "dlopen", "binding", "_linkedBinding", "chdir", "abort", "setuid", "setgid", "seteuid", "setegid", "setgroups", "initgroups", "_debugProcess", "_kill"]) {
  try {
    Object.defineProperty(process, name, { value: deny, writable: false, configurable: false });
  } catch {
    /* ignoré */
  }
}

// ---------------------------------------------------------------------------
// 7. Exécution d'une tâche
// ---------------------------------------------------------------------------
function runPython(job) {
  let compiled;
  try {
    compiled = py.compile(job.code);
  } catch (e) {
    return { status: "error", error: pythonErrorText(e) };
  }
  if (!job.call) {
    const err = py.script(compiled);
    return err == null ? { status: "ok" } : { status: "error", error: String(err) };
  }
  for (let i = 0; i < job.call.cases.length; i++) {
    const started = performance.now();
    const raw = py.call(compiled, job.call.fn, JSON.stringify(job.call.cases[i]));
    const durationMs = Math.round(performance.now() - started);
    send({ type: "case", index: i, durationMs, ...JSON.parse(raw) });
  }
  return { status: "ok" };
}

function pythonErrorText(e) {
  const msg = String(e?.message ?? e);
  // Dernière ligne de la trace Python : « SyntaxError: ... »
  const lines = msg.trim().split("\n");
  return lines[lines.length - 1].slice(0, 500);
}

function sqlValue(v) {
  if (v instanceof Uint8Array) return `<blob ${v.length} octets>`;
  return v;
}

/** Exécute la requête sur une base neuve, en lecture seule. */
function runSqlOn(setup, query, maxRows) {
  const db = new SQL.Database();
  try {
    db.exec(setup);
    db.exec("PRAGMA query_only = 1;");
    // L'itérateur de sql.js libère chaque instruction à l'appel suivant :
    // on note le texte de la première, on vérifie qu'il n'y en a pas de
    // seconde, puis on la prépare à nouveau.
    const it = db.iterateStatements(query);
    const first = it.next();
    if (first.done) return { status: "error", error: "Requête vide" };
    const firstSql = first.value.getSQL();
    if (!it.next().done) return { status: "error", error: "Une seule requête est autorisée" };
    const stmt = db.prepare(firstSql);
    const columns = stmt.getColumnNames();
    const rows = [];
    let truncated = false;
    while (stmt.step()) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(stmt.get().map(sqlValue));
    }
    stmt.free();
    return { status: "ok", sql: { columns, rows, truncated } };
  } catch (e) {
    return { status: "error", error: String(e?.message ?? e).slice(0, 500) };
  } finally {
    db.close();
  }
}

/** Même requête sur chaque base (`setup`, puis `extraSetups`) ; arrêt à la première erreur. */
function runSql(job) {
  const maxRows = Math.min(job.maxRows ?? 1000, MAX_ROWS_HARD);
  const sqlRuns = [];
  for (const setup of [job.setup, ...(job.extraSetups ?? [])]) {
    const r = runSqlOn(setup, job.query, maxRows);
    if (r.status !== "ok") return r;
    sqlRuns.push(r.sql);
  }
  return { status: "ok", sql: sqlRuns[0], sqlRuns };
}

function readJob() {
  return new Promise((resolve, reject) => {
    let buf = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl >= 0) {
        stdin.pause();
        resolve(JSON.parse(buf.slice(0, nl)));
      }
    });
    stdin.on("end", () => reject(new Error("stdin fermé")));
  });
}

send({ type: "ready" });
let job;
try {
  job = await readJob();
} catch {
  exit(0);
}

let result;
try {
  result = job.kind === "python" ? runPython(job) : runSql(job);
} catch (e) {
  result = { status: "error", error: String(e?.message ?? e).slice(0, 500) };
}
send({ type: "done", ...result, stdout: pyOut, stdoutTruncated: pyOutTruncated });
stdout.end(() => exit(0));
