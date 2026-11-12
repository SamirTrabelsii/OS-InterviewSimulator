import type { ChildProcess } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import dgram from "node:dgram";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import os from "node:os";
import { DEFAULT_OPTIONS, EMPTY_ENV, SandboxPool, resolveSandboxUser, sandboxPaths, spawnSandboxProcess } from "./pool";
import type { SandboxResult } from "./protocol";

// Tests d'intégration : vrais processus enfants, vrai Pyodide, vrai sql.js.
// Chaque exécution lance un processus neuf (chargement de Pyodide inclus).

// Chargement de Pyodide : plusieurs secondes par processus.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

const ROOT = process.cwd();
const FORBIDDEN_FILE = path.join(ROOT, "package.json"); // existe, hors liste autorisée
const CANARY_ENV = "SANDBOX_TEST_SECRET";
const CANARY_VALUE = "CANARI-env-7f3a91";
// Dans le conteneur de test Linux (npm run test:sandbox:linux) : SANDBOX_USER=bac.
const SANDBOX_USER = resolveSandboxUser(process.env.SANDBOX_USER);
const ON_LINUX_WITH_USER = process.platform === "linux" && SANDBOX_USER !== undefined;
const ISOLATION = { rootDir: ROOT, jsHeapMb: 128, user: SANDBOX_USER, priority: DEFAULT_OPTIONS.priority };

/** Attend la fin d'un processus et renvoie sa sortie standard. */
function collect(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    child.stdout!.on("data", (d: Buffer) => (out += d));
    child.stderr!.on("data", (d: Buffer) => (err += d));
    child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`code ${code}: ${err}`))));
  });
}

let pool: SandboxPool;
let tcp: net.Server;
let udp: dgram.Socket;
let port = 0;
let tcpConnections = 0;
let udpMessages = 0;

beforeAll(async () => {
  process.env[CANARY_ENV] = CANARY_VALUE;
  pool = new SandboxPool({ maxConcurrent: 3, warm: 1, user: SANDBOX_USER });
  pool.prewarm();

  // Serveur local « appât » : aucune connexion du bac à sable ne doit l'atteindre.
  tcp = net.createServer((s) => {
    tcpConnections++;
    s.destroy();
  });
  await new Promise<void>((r) => tcp.listen(0, "127.0.0.1", r));
  port = (tcp.address() as net.AddressInfo).port;
  udp = dgram.createSocket("udp4");
  udp.on("message", () => udpMessages++);
  await new Promise<void>((r) => udp.bind(port, "127.0.0.1", r));
});

afterAll(() => {
  pool?.close();
  tcp?.close();
  udp?.close();
  delete process.env[CANARY_ENV];
});

const python = (code: string, timeoutMs?: number) => pool.run({ kind: "python", code, timeoutMs });

/** Exécute un script dont la dernière ligne imprimée est un JSON. */
async function pythonJson(code: string, timeoutMs?: number) {
  const r = await python(code, timeoutMs);
  expect(r.status, r.error).toBe("ok");
  const last = r.stdout.trim().split("\n").at(-1)!;
  return JSON.parse(last);
}

function expectNoLeak(r: SandboxResult) {
  const all = JSON.stringify(r);
  expect(all).not.toContain(CANARY_VALUE);
  expect(all).not.toContain('"name": "portail"');
  expect(all).not.toContain('"name":"portail"');
}

describe.concurrent("bac à sable — fonctionnement normal", () => {
  it("appelle la fonction du candidat sur chaque cas", async () => {
    const r = await pool.run({
      kind: "python",
      code: "def somme(a, b):\n    return a + b",
      call: { fn: "somme", cases: [[1, 2], [[1], [2]], ["a", "b"]] },
    });
    expect(r.status).toBe("ok");
    expect(r.cases.map((c) => (c.ok ? c.value : c.error))).toEqual([3, [1, 2], "ab"]);
  });

  it("isole les cas : espace de noms neuf à chaque appel", async () => {
    const r = await pool.run({
      kind: "python",
      code: "compteur = 0\ndef f():\n    global compteur\n    compteur += 1\n    return compteur",
      call: { fn: "f", cases: [[], [], []] },
    });
    expect(r.cases.map((c) => c.ok && c.value)).toEqual([1, 1, 1]);
  });

  it("signale une erreur de syntaxe, une exception et une fonction absente", async () => {
    const syntax = await python("def f(:\n  pass");
    expect(syntax.status).toBe("error");
    expect(syntax.error).toMatch(/SyntaxError/);

    const r = await pool.run({
      kind: "python",
      code: "def f(x):\n    return 1 / x",
      call: { fn: "f", cases: [[0]] },
    });
    expect(r.cases[0]).toMatchObject({ ok: false, error: expect.stringMatching(/ZeroDivisionError/) });

    const missing = await pool.run({ kind: "python", code: "x = 1", call: { fn: "f", cases: [[]] } });
    expect(missing.cases[0]).toMatchObject({ ok: false, error: expect.stringMatching(/introuvable/) });
  });

  it("exécute une requête SQL sur la base générée", async () => {
    const r = await pool.run({
      kind: "sql",
      setup: "CREATE TABLE t(a INTEGER, b TEXT); INSERT INTO t VALUES (1,'x'),(2,'y');",
      query: "SELECT a, b, a * 10 AS c FROM t ORDER BY a",
    });
    expect(r.status).toBe("ok");
    expect(r.sql).toEqual({ columns: ["a", "b", "c"], rows: [[1, "x", 10], [2, "y", 20]], truncated: false });
  });
});

describe.concurrent("bac à sable — code malveillant", () => {
  it("tue une boucle infinie dans le délai", async () => {
    const r = await python("while True:\n    pass", 1_000);
    expect(r.status).toBe("timeout");
    expect(r.durationMs).toBeGreaterThanOrEqual(1_000);
    expect(r.durationMs).toBeLessThan(3_000);
  });

  it("tue une boucle infinie même après des résultats partiels", async () => {
    const r = await pool.run({
      kind: "python",
      code: "def f(n):\n    while n > 0:\n        pass\n    return n",
      call: { fn: "f", cases: [[0], [1], [0]] },
      timeoutMs: 1_000,
    });
    expect(r.status).toBe("timeout");
    expect(r.cases).toHaveLength(1);
    expect(r.cases[0]).toMatchObject({ ok: true, value: 0 });
  });

  it("arrête une allocation mémoire excessive (liste, octets, chaîne)", async () => {
    for (const code of ["x = [0] * (10 ** 9)", "x = bytearray(1024 ** 3)", "x = 'a' * (600 * 1024 ** 2)"]) {
      const r = await python(code);
      expect(r.status, code).toBe("memory");
    }
  });

  it("arrête une croissance mémoire progressive", async () => {
    const r = await python("blocs = []\nwhile True:\n    blocs.append(bytearray(10 * 1024 ** 2))", 8_000);
    expect(r.status).toBe("memory");
  });

  it("survit à une récursion infinie", async () => {
    const r = await python("def f(n):\n    return f(n + 1)\nf(0)");
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/RecursionError/);
  });

  it("ne lit pas les fichiers du serveur depuis Python", async () => {
    const out = await pythonJson(`
import json, os
res = {}
for p in ["/etc/passwd", "/proc/self/environ", ${JSON.stringify(FORBIDDEN_FILE)}]:
    try:
        open(p).read()
        res[p] = "LU"
    except Exception as e:
        res[p] = type(e).__name__
res["listing"] = sorted(os.listdir("/"))
print(json.dumps(res))
`);
    for (const [k, v] of Object.entries(out)) if (k !== "listing") expect(v, k).not.toBe("LU");
    // Seul le système de fichiers virtuel de Pyodide est visible.
    expect(out.listing).not.toContain("Users");
    expect(out.listing).not.toContain("app");
  });

  it("refuse le montage du vrai disque via pyodide_js (évasion Python → JS)", async () => {
    const r = await python(`
import sys
sys.meta_path.pop(0)          # retire le bloqueur d'imports
import pyodide_js
pyodide_js.mountNodeFS("/hote", ${JSON.stringify(ROOT)})
print(open("/hote/package.json").read())
`);
    expect(r.status).not.toBe("ok");
    expect(r.stdout).not.toContain("portail");
    expectNoLeak(r);
  });

  it("ne voit pas les variables d'environnement du serveur", async () => {
    const out = await pythonJson("import os, json\nprint(json.dumps(dict(os.environ)))");
    expect(JSON.stringify(out)).not.toContain(CANARY_VALUE);
    expect(out).not.toHaveProperty(CANARY_ENV);
    expect(out).not.toHaveProperty("DATABASE_URL");
    expect(out).not.toHaveProperty("PATH", process.env.PATH);
  });

  it("import js ne donne ni process ni fetch", async () => {
    const out = await pythonJson(`
import js, json
res = {}
for name in ["process", "fetch", "require", "globalThis", "eval", "Function", "WebAssembly"]:
    try:
        getattr(js, name)
        res[name] = "TROUVÉ"
    except AttributeError:
        res[name] = "absent"
print(json.dumps(res))
`);
    expect(Object.values(out).every((v) => v === "absent")).toBe(true);
  });

  it("bloque l'évasion par le constructeur Function", async () => {
    const r = await python(`
import sys
sys.meta_path.pop(0)
import pyodide_js
F = pyodide_js.constructor.constructor
print(F("return typeof process")())
`);
    expect(r.status).toBe("error");
    expect(r.error).toMatch(/EvalError|Code generation/i);
  });

  it("n'atteint pas le réseau (urllib, pyfetch, vraies sockets Node)", async () => {
    const before = tcpConnections;
    const out = await pythonJson(`
import json, sys
res = {}
try:
    import urllib.request
    urllib.request.urlopen("http://127.0.0.1:${port}/", timeout=2)
    res["urllib"] = "OK"
except BaseException as e:
    res["urllib"] = type(e).__name__
try:
    import socket
    s = socket.socket(); s.settimeout(2); s.connect(("127.0.0.1", ${port}))
    res["socket"] = "OK"
except BaseException as e:
    res["socket"] = type(e).__name__
try:
    from pyodide.http import pyfetch
    res["pyfetch"] = "importé"
except BaseException as e:
    res["pyfetch"] = type(e).__name__
try:
    sys.meta_path.pop(0)
    import pyodide_js
    pyodide_js._api.initializeNodeSockFS()
    s = socket.socket(); s.settimeout(2); s.connect(("127.0.0.1", ${port}))
    s.send(b"x")
    res["sockfs"] = "OK"
except BaseException as e:
    res["sockfs"] = type(e).__name__
print(json.dumps(res))
`);
    for (const [k, v] of Object.entries(out)) expect(v, k).not.toBe("OK");
    expect(out.pyfetch).not.toBe("importé");
    expect(tcpConnections).toBe(before);
  });

  it("ne lance pas de processus", async () => {
    const attacks = {
      subprocess: "import subprocess\nprint('RÉSULTAT', subprocess.run(['whoami'], capture_output=True))",
      system: "import os\nprint('RÉSULTAT', os.system('whoami'))",
      popen: "import os\nprint('RÉSULTAT', os.popen('whoami').read())",
    };
    for (const [name, code] of Object.entries(attacks)) {
      const r = await python(code);
      // Soit Python refuse (OSError…), soit Pyodide tente child_process et
      // le modèle de permissions de Node l'arrête.
      if (r.status === "ok") {
        expect(r.stdout, name).not.toMatch(/RÉSULTAT (0|CompletedProcess\(.*returncode=0)/);
      } else {
        expect(r.status, name).toBe("error");
        expect(r.error, name).toMatch(/allow-child-process|OSError|not supported|Errno/i);
      }
    }
  });

  it("tronque une sortie standard énorme", async () => {
    const r = await python("for _ in range(100000):\n    print('x' * 100)");
    expect(r.status).toBe("ok");
    expect(r.stdoutTruncated).toBe(true);
    expect(r.stdout.length).toBeLessThanOrEqual(64 * 1024);
  });

  it("tue l'enfant qui renvoie une valeur géante", async () => {
    const r = await pool.run({ kind: "python", code: "def f():\n    return 'x' * (5 * 1024 ** 2)", call: { fn: "f", cases: [[]] } });
    expect(r.status).toBe("output_limit");
  });

  it("refuse un code trop long sans lancer de processus", async () => {
    const r = await python("#" + "x".repeat(200 * 1024));
    expect(r).toMatchObject({ status: "error", error: "Code trop long", durationMs: 0 });
  });
});

describe("bac à sable — étanchéité entre exécutions", () => {
  it("deux exécutions successives ne partagent aucun état", async () => {
    const first = await python(`
import builtins, sys
builtins.FUITE = "état du candidat A"
sys.modules["fuite"] = type(sys)("fuite")
with open("/tmp/fuite.txt", "w") as f:
    f.write("A")
print("écrit")
`);
    expect(first.stdout).toContain("écrit");
    const second = await pythonJson(`
import builtins, json, os, sys
print(json.dumps({
    "builtin": hasattr(builtins, "FUITE"),
    "module": "fuite" in sys.modules,
    "fichier": os.path.exists("/tmp/fuite.txt"),
}))
`);
    expect(second).toEqual({ builtin: false, module: false, fichier: false });
  });
});

describe.concurrent("bac à sable — SQL malveillant", () => {
  const setup = "CREATE TABLE ventes(id INTEGER, montant INTEGER); INSERT INTO ventes VALUES (1, 10), (2, 20);";

  it("coupe une CTE récursive infinie", async () => {
    const r = await pool.run({
      kind: "sql",
      setup,
      query: "WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM r) SELECT count(*) FROM r",
      timeoutMs: 1_000,
    });
    expect(r.status).toBe("timeout");
    expect(r.durationMs).toBeLessThan(3_000);
  });

  it("refuse les modifications de la base (lecture seule)", async () => {
    for (const query of ["DROP TABLE ventes", "UPDATE ventes SET montant = 0", "INSERT INTO ventes VALUES (3, 30)"]) {
      const r = await pool.run({ kind: "sql", setup, query });
      expect(r.status, query).toBe("error");
      expect(r.error, query).toMatch(/readonly|read-only|query_only/i);
    }
  });

  it("refuse plusieurs instructions", async () => {
    const r = await pool.run({ kind: "sql", setup, query: "SELECT 1; DROP TABLE ventes" });
    expect(r).toMatchObject({ status: "error", error: "Une seule requête est autorisée" });
  });

  it("arrête une allocation mémoire excessive", async () => {
    const r = await pool.run({ kind: "sql", setup, query: "SELECT length(randomblob(900000000))" });
    expect(["memory", "error"]).toContain(r.status);
    expect(r.error).toMatch(/memory|mémoire|too big/i);
  });

  it("tronque un résultat trop long", async () => {
    const r = await pool.run({
      kind: "sql",
      setup,
      query: "WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM r WHERE x < 5000) SELECT x FROM r",
      maxRows: 100,
    });
    expect(r.status).toBe("ok");
    expect(r.sql?.rows).toHaveLength(100);
    expect(r.sql?.truncated).toBe(true);
  });
});

describe("bac à sable — charge", () => {
  it("répond « busy » quand la file est pleine", async () => {
    const small = new SandboxPool({ maxConcurrent: 1, maxQueue: 0, warm: 0 });
    try {
      const a = small.run({ kind: "python", code: "x = 1" });
      const b = await small.run({ kind: "python", code: "x = 1" });
      expect(b.status).toBe("busy");
      expect((await a).status).toBe("ok");
    } finally {
      small.close();
    }
  });
});

describe("frontière Node : JS arbitraire avec les drapeaux de l'enfant", () => {
  // Pire cas : le candidat exécute du JavaScript arbitraire dans l'enfant.
  it("refuse fichiers, env, processus, workers, réseau, eval et inspecteur", async () => {
    const fixture = path.join(ROOT, "tests", "fixtures", "sandbox-escape.mjs");
    const before = { tcp: tcpConnections, udp: udpMessages };
    const stdout = await collect(
      spawnSandboxProcess(ISOLATION, fixture, [FORBIDDEN_FILE, String(port)], { extraReadable: [fixture], stdio: ["ignore", "pipe", "pipe"] }),
    );
    const { results, info } = JSON.parse(stdout) as {
      results: Record<string, { ok: boolean; code?: string; error?: string; value?: string }>;
      info: { priority: number; uid: number | null; signalParent: string };
    };

    for (const [name, r] of Object.entries(results)) {
      expect(r.ok, `${name} aurait dû échouer : ${r.value}`).toBe(false);
    }
    expect(results.readFile.code).toBe("ERR_ACCESS_DENIED");
    expect(results.writeFile.code).toBe("ERR_ACCESS_DENIED");
    expect(results.env.code).toBe("EMPTY");
    expect(results.childProcess.code).toBe("ERR_ACCESS_DENIED");
    expect(results.worker.code).toBe("ERR_ACCESS_DENIED");
    expect(results.tcp.code).toBe("ERR_ACCESS_DENIED");
    expect(results.dns.code).toBe("ERR_ACCESS_DENIED");
    expect(results.eval.error).toMatch(/Code generation from strings disallowed/);
    expect(stdout).not.toContain(CANARY_VALUE);
    // Laisse passer un éventuel paquet UDP en vol avant de compter.
    await new Promise((r) => setTimeout(r, 200));
    expect({ tcp: tcpConnections, udp: udpMessages }).toEqual(before);

    // Priorité CPU minimale (le serveur web et le temps réel passent d'abord).
    expect(info.priority).toBe(os.constants.priority.PRIORITY_LOW);
    if (ON_LINUX_WITH_USER) {
      expect(info.uid).toBe(SANDBOX_USER!.uid);
      expect(info.uid).not.toBe(process.getuid!());
      expect(info.signalParent).toBe("EPERM");
    }
  });
});

describe("chargement local des moteurs", () => {
  it("fige les versions exactes de Pyodide et sql.js", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const lock = JSON.parse(readFileSync(path.join(ROOT, "package-lock.json"), "utf8"));
    for (const name of ["pyodide", "sql.js"]) {
      expect(pkg.dependencies[name], name).toMatch(/^\d+\.\d+\.\d+$/);
      const locked = lock.packages[`node_modules/${name}`];
      expect(locked.version, name).toBe(pkg.dependencies[name]);
      expect(locked.integrity, name).toMatch(/^sha512-/);
      const installed = JSON.parse(readFileSync(path.join(ROOT, "node_modules", name, "package.json"), "utf8"));
      expect(installed.version, name).toBe(pkg.dependencies[name]);
    }
  });

  it("ne référence aucun CDN : Pyodide est configuré sur ses fichiers locaux", async () => {
    const out = await pythonJson(`
import json, sys
sys.meta_path.pop(0)
import pyodide_js
cfg = pyodide_js._api.config
res = {k: str(getattr(cfg, k, "")) for k in ("indexURL", "packageBaseUrl", "cdnUrl", "lockFileURL", "packageCacheDir")}
res["version"] = pyodide_js.version
try:
    import numpy
    res["numpy"] = "importé"
except ModuleNotFoundError:
    res["numpy"] = "absent"
print(json.dumps(res))
`);
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(out.version).toBe(pkg.dependencies.pyodide);
    expect(out.numpy).toBe("absent");
    for (const k of ["indexURL", "packageBaseUrl", "cdnUrl", "lockFileURL", "packageCacheDir"]) {
      expect(out[k], k).not.toMatch(/^https?:|jsdelivr|cdn\./i);
      expect(out[k], k).toContain("pyodide");
    }
  });

  it("le script enfant ne contient aucune URL distante", () => {
    const child = readFileSync(path.join(ROOT, "sandbox", "child.mjs"), "utf8");
    expect(child).not.toMatch(/https?:\/\//);
  });
});

describe.runIf(ON_LINUX_WITH_USER)("Linux : utilisateur dédié du bac à sable", () => {
  it("protège le serveur même SANS le modèle de permissions de Node", async () => {
    const fixture = path.join(ROOT, "tests", "fixtures", "sandbox-uid-only.mjs");
    // Volontairement sans --permission : on teste la seule couche « utilisateur ».
    const child = spawn(process.execPath, [fixture, ROOT], {
      env: EMPTY_ENV,
      uid: SANDBOX_USER!.uid,
      gid: SANDBOX_USER!.gid,
      cwd: "/",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const results = JSON.parse(await collect(child)) as Record<string, { ok: boolean; code?: string; value?: string }>;
    for (const [name, r] of Object.entries(results)) {
      expect(r.ok, `${name} aurait dû échouer : ${r.value}`).toBe(false);
    }
    expect(results.signalParent.code).toBe("EPERM");
    expect(results.readParentEnviron.code).toBe("EACCES");
    expect(results.writeApp.code).toBe("EACCES");
  });

  it("tous les threads de l'enfant tournent en priorité minimale (nice 19)", async () => {
    const { childScript, pyodideDir, sqljsDir } = sandboxPaths(ROOT);
    const child = spawnSandboxProcess(ISOLATION, childScript, [pyodideDir, sqljsDir]);
    try {
      // Attend « ready » : Pyodide chargé, tous les threads de V8 créés.
      await new Promise<void>((resolve, reject) => {
        child.stdout!.on("data", (d: Buffer) => d.toString().includes('"ready"') && resolve());
        child.on("exit", (code) => reject(new Error(`fin prématurée (${code})`)));
      });
      const tasks = readdirSync(`/proc/${child.pid}/task`);
      expect(tasks.length).toBeGreaterThan(1);
      for (const tid of tasks) {
        const stat = readFileSync(`/proc/${child.pid}/task/${tid}/stat`, "utf8");
        // Champ 19 de /proc/.../stat (après le nom entre parenthèses) : nice.
        const nice = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[16]);
        expect(nice, `thread ${tid}`).toBe(19);
      }
    } finally {
      child.kill("SIGKILL");
    }
  });

  it("le plafond de mémoire résidente tue l'enfant", async () => {
    // Plafond WASM relevé pour que seul le chien de garde RSS puisse agir.
    const small = new SandboxPool({ warm: 0, user: SANDBOX_USER, wasmMemoryBytes: 1024 ** 3, rssLimitBytes: 300 * 1024 ** 2 });
    try {
      // Toucher chaque page rend la mémoire résidente (pas seulement réservée).
      const code = "x = bytearray(500 * 1024 ** 2)\nfor i in range(0, len(x), 4096):\n    x[i] = 1\nwhile True:\n    pass";
      const r = await small.run({ kind: "python", code, timeoutMs: 8_000 });
      expect(r.status).toBe("memory");
      expect(r.durationMs).toBeLessThan(8_000);
    } finally {
      small.close();
    }
  });
});
