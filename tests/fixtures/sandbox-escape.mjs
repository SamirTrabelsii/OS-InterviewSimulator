// Script hostile lancé AVEC LES MÊMES DRAPEAUX que l'enfant du bac à sable.
// Il simule le pire cas : le candidat a réussi à sortir de Python et exécute
// du JavaScript arbitraire. Chaque tentative doit échouer.
// Usage : node <drapeaux> sandbox-escape.mjs <fichier-interdit> <port-local>

const [forbiddenFile, port] = process.argv.slice(2);
const results = {};

async function attempt(name, fn) {
  try {
    const value = await fn();
    results[name] = { ok: true, value: String(value).slice(0, 200) };
  } catch (e) {
    results[name] = { ok: false, code: e?.code ?? null, error: String(e?.message ?? e).slice(0, 200) };
  }
}

const fs = process.getBuiltinModule("node:fs");
const os = process.getBuiltinModule("node:os");
const path = process.getBuiltinModule("node:path");

await attempt("readFile", () => fs.readFileSync(forbiddenFile, "utf8"));
await attempt("readParentEnviron", () => fs.readFileSync(`/proc/${process.ppid}/environ`, "utf8"));
await attempt("writeFile", () => {
  fs.writeFileSync(path.join(os.tmpdir(), "portail-sandbox-escape.txt"), "x");
  return "écrit";
});
// Sous Windows, libuv réinjecte quelques variables système (SYSTEMROOT,
// PATH…) dans un env vide ; on les ignore. Sous Linux, l'env est vide.
const WINDOWS_SYSTEM_VARS = new Set(["HOMEDRIVE", "HOMEPATH", "LOGONSERVER", "PATH", "SYSTEMDRIVE", "SYSTEMROOT", "TEMP", "TMP", "USERDOMAIN", "USERNAME", "USERPROFILE", "WINDIR"]);
await attempt("env", () => {
  const keys = Object.keys(process.env).filter((k) => !(process.platform === "win32" && WINDOWS_SYSTEM_VARS.has(k.toUpperCase())));
  if (keys.length) return keys.join(",");
  throw Object.assign(new Error("vide"), { code: "EMPTY" });
});
await attempt("childProcess", () => process.getBuiltinModule("node:child_process").execFileSync(process.execPath, ["-e", "1"]).toString());
await attempt("worker", () => {
  const { Worker } = process.getBuiltinModule("node:worker_threads");
  new Worker("1", { eval: true });
  return "worker lancé";
});
await attempt("tcp", () => {
  const net = process.getBuiltinModule("node:net");
  return new Promise((resolve, reject) => {
    const s = net.connect(Number(port), "127.0.0.1");
    s.on("connect", () => {
      s.destroy();
      resolve("connecté");
    });
    s.on("error", reject);
  });
});
await attempt("fetch", async () => {
  const r = await fetch(`http://127.0.0.1:${port}/`);
  return r.status;
});
await attempt("metadata", async () => {
  const r = await fetch("http://169.254.169.254/computeMetadata/v1/", { headers: { "Metadata-Flavor": "Google" } });
  return r.status;
});
await attempt("dns", () => process.getBuiltinModule("node:dns").promises.lookup("example.com").then((r) => r.address));
await attempt("udp", () => {
  const dgram = process.getBuiltinModule("node:dgram");
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.on("error", reject);
    sock.send("x", Number(port), "127.0.0.1", (err) => {
      sock.close();
      if (err) reject(err);
      else resolve("envoyé");
    });
  });
});
await attempt("eval", () => (0, eval)("1 + 1"));
await attempt("inspector", () => {
  process.getBuiltinModule("node:inspector").open(0);
  return "ouvert";
});

process.stdout.write(JSON.stringify(results));
