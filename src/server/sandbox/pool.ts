// Pas de `import "server-only"` : ce module est aussi chargé par server.ts,
// hors de Next (où `server-only` lève une erreur). Il ne contient aucun
// secret, et `node:child_process` ferait de toute façon échouer un import
// côté navigateur au build.
import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CaseResult, ChildMessage, SandboxJob, SandboxResult, SandboxStatus } from "./protocol";

// Bac à sable serveur : exécute le code des candidats (Python via Pyodide,
// SQL via sql.js) dans un processus enfant Node jetable. Voir
// docs/ARCHITECTURE.md § 3.5 pour le modèle de menaces.
//
// Frontière de sécurité = le processus enfant lui-même :
//   - env vide (aucun secret, aucun NODE_OPTIONS hérité) ;
//   - modèle de permissions de Node : lecture limitée aux fichiers des
//     moteurs, aucune écriture, aucun réseau (Node ≥ 25 : pas de
//     --allow-net), ni processus, ni workers, ni addons, ni inspecteur ;
//   - pas de génération de code depuis des chaînes (ferme l'évasion
//     Python → `Function` → JS global) ;
//   - délai, plafonds mémoire (WASM, tas JS, RSS sous Linux) et sortie
//     bornée, tous appliqués ou vérifiés par le parent ;
//   - un processus par exécution, tué ensuite ; un seul « chaud » d'avance.

export type SandboxOptions = {
  /** Racine du projet (contient node_modules/ et sandbox/). */
  rootDir: string;
  /** Exécutions simultanées (CPU : 1 vCPU sur Cloud Run). */
  maxConcurrent: number;
  /** Tâches en attente au-delà desquelles on répond « busy ». */
  maxQueue: number;
  /** Processus préchargés en attente d'une tâche. */
  warm: number;
  /** Plafond de chaque mémoire WASM (Pyodide, sql.js). */
  wasmMemoryBytes: number;
  /** Plafond du tas JS de l'enfant (Mo). */
  jsHeapMb: number;
  /** Plafond de mémoire résidente, vérifié par le parent (Linux seulement). */
  rssLimitBytes: number;
  /** Plafond de la sortie Python capturée. */
  stdoutLimitBytes: number;
  /** Plafond de tout ce que l'enfant écrit vers le parent (stdout + stderr). */
  channelLimitBytes: number;
  /** Délai de chargement d'un processus (Pyodide : quelques secondes). */
  startupTimeoutMs: number;
  /** Délais par défaut et maximum d'une tâche. */
  defaultTimeoutMs: { python: number; sql: number };
  maxTimeoutMs: number;
  /** Taille maximale du code ou de la requête du candidat. */
  maxCodeBytes: number;
};

export const DEFAULT_OPTIONS: SandboxOptions = {
  rootDir: process.cwd(),
  maxConcurrent: 2,
  maxQueue: 8,
  warm: 1,
  wasmMemoryBytes: 256 * 1024 * 1024,
  jsHeapMb: 192,
  rssLimitBytes: 600 * 1024 * 1024,
  stdoutLimitBytes: 64 * 1024,
  channelLimitBytes: 512 * 1024,
  startupTimeoutMs: 60_000,
  defaultTimeoutMs: { python: 5_000, sql: 2_000 },
  maxTimeoutMs: 10_000,
  maxCodeBytes: 100 * 1024,
};

/** Environnement de l'enfant : vide (aucun secret, aucun NODE_OPTIONS). */
export const EMPTY_ENV = {} as NodeJS.ProcessEnv;

export function sandboxPaths(rootDir: string) {
  return {
    pyodideDir: path.join(rootDir, "node_modules", "pyodide"),
    sqljsDir: path.join(rootDir, "node_modules", "sql.js", "dist"),
    childScript: path.join(rootDir, "sandbox", "child.mjs"),
  };
}

/**
 * Drapeaux Node du processus enfant. Exportés pour que les tests puissent
 * vérifier la frontière avec un script JS hostile (évasion supposée réussie).
 */
export function sandboxNodeFlags(opts: Pick<SandboxOptions, "rootDir" | "jsHeapMb">, extraReadable: string[] = []) {
  const p = sandboxPaths(opts.rootDir);
  return [
    "--permission",
    `--allow-fs-read=${path.join(p.pyodideDir, "*")}`,
    `--allow-fs-read=${path.join(p.sqljsDir, "*")}`,
    `--allow-fs-read=${p.childScript}`,
    ...extraReadable.map((f) => `--allow-fs-read=${f}`),
    // Volontairement absents : --allow-fs-write, --allow-net,
    // --allow-child-process, --allow-worker, --allow-addons,
    // --allow-inspector, --allow-wasi, --allow-ffi.
    "--disallow-code-generation-from-strings",
    `--max-old-space-size=${opts.jsHeapMb}`,
  ];
}

type Waiter = () => void;

class SandboxChild {
  readonly proc: ChildProcess;
  readonly ready: Promise<void>;
  private buffer = "";
  private bytes = 0;
  private stderrTail = "";
  private onMessage: ((m: ChildMessage) => void) | null = null;
  private onFailure: ((status: SandboxStatus, detail: string) => void) | null = null;
  private failure: { status: SandboxStatus; detail: string } | null = null;
  private watchdog: NodeJS.Timeout | null = null;

  constructor(private opts: SandboxOptions) {
    const p = sandboxPaths(opts.rootDir);
    this.proc = spawn(
      process.execPath,
      [...sandboxNodeFlags(opts), p.childScript, p.pyodideDir, p.sqljsDir, String(opts.wasmMemoryBytes), String(opts.stdoutLimitBytes)],
      { env: EMPTY_ENV, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );

    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail("crash", "délai de chargement dépassé");
      }, opts.startupTimeoutMs);
      this.onMessage = (m) => {
        if (m.type === "ready") {
          clearTimeout(timer);
          this.onMessage = null;
          resolve();
        }
      };
      this.onFailure = (status, detail) => {
        clearTimeout(timer);
        reject(new Error(`${status}: ${detail}`));
      };
    });
    // Évite un rejet non géré pour un processus chaud jamais utilisé.
    this.ready.catch(() => {});

    this.proc.stdout!.setEncoding("utf8");
    this.proc.stdout!.on("data", (chunk: string) => this.onStdout(chunk));
    this.proc.stderr!.setEncoding("utf8");
    this.proc.stderr!.on("data", (chunk: string) => {
      this.count(chunk);
      this.stderrTail = (this.stderrTail + chunk).slice(-4096);
    });
    this.proc.stdin!.on("error", () => {});
    this.proc.on("exit", (code, signal) => {
      this.stopWatchdog();
      const oom = /heap out of memory|Allocation failed/i.test(this.stderrTail);
      this.fail(oom ? "memory" : "crash", `fin du processus (code ${code}, signal ${signal})`);
    });
    this.proc.on("error", (err) => this.fail("crash", err.message));
    this.startWatchdog();
  }

  get alive() {
    return this.failure === null && this.proc.exitCode === null;
  }

  get diagnostics() {
    return this.stderrTail;
  }

  private count(chunk: string) {
    this.bytes += Buffer.byteLength(chunk);
    if (this.bytes > this.opts.channelLimitBytes) {
      this.fail("output_limit", "sortie trop longue");
    }
  }

  private onStdout(chunk: string) {
    this.count(chunk);
    if (this.failure) return;
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      let msg: ChildMessage;
      try {
        msg = JSON.parse(line) as ChildMessage;
      } catch {
        this.fail("crash", "message illisible");
        return;
      }
      this.onMessage?.(msg);
    }
  }

  /** Mémoire résidente sous Linux (/proc). Ailleurs : plafonds WASM et tas JS seulement. */
  private startWatchdog() {
    if (process.platform !== "linux") return;
    this.watchdog = setInterval(() => {
      const pid = this.proc.pid;
      if (!pid) return;
      readFile(`/proc/${pid}/status`, "utf8")
        .then((s) => {
          const kb = Number(/VmRSS:\s+(\d+)/.exec(s)?.[1] ?? 0);
          if (kb * 1024 > this.opts.rssLimitBytes) this.fail("memory", "mémoire résidente dépassée");
        })
        .catch(() => {});
    }, 100);
    this.watchdog.unref();
  }

  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  /** Échec définitif : le processus est tué, l'appelant est prévenu. */
  fail(status: SandboxStatus, detail: string) {
    if (this.failure) return;
    this.failure = { status, detail };
    this.kill();
    this.onFailure?.(status, detail);
  }

  kill() {
    this.stopWatchdog();
    if (this.proc.exitCode === null && this.proc.signalCode === null) this.proc.kill("SIGKILL");
  }

  /** Envoie la tâche et attend le résultat, dans le délai imparti. */
  execute(job: SandboxJob, timeoutMs: number): Promise<SandboxResult> {
    return new Promise((resolve) => {
      const cases: CaseResult[] = [];
      const started = performance.now();
      const finish = (r: Omit<SandboxResult, "durationMs" | "cases">) => {
        clearTimeout(timer);
        this.onMessage = null;
        this.onFailure = null;
        this.kill();
        resolve({ ...r, cases, durationMs: Math.round(performance.now() - started) });
      };
      const timer = setTimeout(() => this.fail("timeout", "délai dépassé"), timeoutMs);

      this.onFailure = (status, detail) => finish({ status, stdout: "", stdoutTruncated: false, error: messageFor(status, detail) });
      this.onMessage = (m) => {
        if (m.type === "case") {
          const { type, ...c } = m;
          void type;
          cases.push(c as CaseResult);
        } else if (m.type === "done") {
          const memory = m.status === "error" && /^MemoryError|out of memory|Limite mémoire/i.test(m.error ?? "");
          finish({
            status: memory ? "memory" : m.status,
            error: m.error,
            sql: m.sql,
            stdout: m.stdout,
            stdoutTruncated: m.stdoutTruncated,
          });
        }
      };
      if (this.failure) {
        finish({ status: this.failure.status, stdout: "", stdoutTruncated: false, error: messageFor(this.failure.status, this.failure.detail) });
        return;
      }
      this.proc.stdin!.write(JSON.stringify(job) + "\n");
    });
  }
}

function messageFor(status: SandboxStatus, detail: string) {
  switch (status) {
    case "timeout":
      return "Temps d'exécution dépassé";
    case "memory":
      return "Mémoire dépassée";
    case "output_limit":
      return "Sortie trop longue";
    case "busy":
      return "Serveur occupé, réessayez dans quelques secondes";
    default:
      return `Exécution interrompue (${detail})`;
  }
}

function emptyResult(status: SandboxStatus, error: string): SandboxResult {
  return { status, error, durationMs: 0, stdout: "", stdoutTruncated: false, cases: [] };
}

export class SandboxPool {
  readonly opts: SandboxOptions;
  private warmChildren: SandboxChild[] = [];
  private active = 0;
  private queue: Waiter[] = [];
  private closed = false;

  constructor(opts: Partial<SandboxOptions> = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  /** Prépare les processus chauds (appelé au démarrage du serveur). */
  prewarm() {
    this.replenish();
  }

  get stats() {
    return { active: this.active, queued: this.queue.length, warm: this.warmChildren.length };
  }

  async run(job: SandboxJob): Promise<SandboxResult> {
    if (this.closed) return emptyResult("crash", "Bac à sable arrêté");
    const size = Buffer.byteLength(job.kind === "python" ? job.code : job.query + job.setup);
    if (size > this.opts.maxCodeBytes) return emptyResult("error", "Code trop long");
    if (this.active >= this.opts.maxConcurrent && this.queue.length >= this.opts.maxQueue) {
      return emptyResult("busy", messageFor("busy", ""));
    }

    await this.acquire();
    try {
      const child = this.takeChild();
      try {
        await child.ready;
      } catch (e) {
        child.kill();
        return emptyResult("crash", `Exécution impossible (${(e as Error).message})`);
      }
      const timeoutMs = Math.min(job.timeoutMs ?? this.opts.defaultTimeoutMs[job.kind], this.opts.maxTimeoutMs);
      return await child.execute(job, timeoutMs);
    } finally {
      this.release();
    }
  }

  /** Arrête tous les processus (tests, arrêt du serveur). */
  close() {
    this.closed = true;
    for (const c of this.warmChildren) c.kill();
    this.warmChildren = [];
  }

  private takeChild(): SandboxChild {
    let child: SandboxChild | undefined;
    while ((child = this.warmChildren.shift())) {
      if (child.alive) break;
    }
    // Le remplaçant n'est préparé qu'après la tâche (release) : sur 1 vCPU,
    // charger Pyodide pendant une exécution chronométrée la ralentirait.
    return child ?? new SandboxChild(this.opts);
  }

  private replenish() {
    if (this.closed) return;
    this.warmChildren = this.warmChildren.filter((c) => c.alive);
    while (this.warmChildren.length < this.opts.warm) {
      this.warmChildren.push(new SandboxChild(this.opts));
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.opts.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) =>
      this.queue.push(() => {
        this.active++;
        resolve();
      }),
    );
  }

  private release() {
    this.active--;
    this.queue.shift()?.();
    this.replenish();
  }
}

const KEY = Symbol.for("portail.sandbox");
type GlobalWithSandbox = typeof globalThis & { [KEY]?: SandboxPool };

/** Bac à sable partagé du processus (une seule instance Cloud Run). */
export function getSandbox(): SandboxPool {
  const g = globalThis as GlobalWithSandbox;
  g[KEY] ??= new SandboxPool();
  return g[KEY];
}
