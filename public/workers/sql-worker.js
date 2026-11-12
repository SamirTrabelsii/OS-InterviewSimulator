// Exécution SQL dans le navigateur du candidat (sql.js, servi par
// l'application). Tourne dans un Web Worker : une requête sans fin
// (CTE récursive) ne fige pas la page, le worker est simplement arrêté.
// Seul le jeu de données VISIBLE arrive ici ; la correction se fait sur
// le serveur.
/* global initSqlJs */
importScripts("/vendor/sqljs/sql-wasm.js");

const ready = initSqlJs({ locateFile: (file) => `/vendor/sqljs/${file}` });

self.onmessage = async (event) => {
  const { id, setup, query, maxRows } = event.data;
  const started = performance.now();
  const reply = (r) => self.postMessage({ id, durationMs: Math.round(performance.now() - started), ...r });
  let db;
  try {
    const SQL = await ready;
    db = new SQL.Database();
    db.exec(setup);
    db.exec("PRAGMA query_only = 1;");
    const it = db.iterateStatements(query);
    const first = it.next();
    if (first.done) return reply({ ok: false, error: "Requête vide" });
    const text = first.value.getSQL();
    if (!it.next().done) return reply({ ok: false, error: "Une seule requête est autorisée" });
    const stmt = db.prepare(text);
    const columns = stmt.getColumnNames();
    const rows = [];
    let truncated = false;
    while (stmt.step()) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(stmt.get().map((v) => (v instanceof Uint8Array ? `<blob ${v.length} octets>` : v)));
    }
    stmt.free();
    reply({ ok: true, columns, rows, truncated });
  } catch (e) {
    reply({ ok: false, error: String((e && e.message) || e).slice(0, 500) });
  } finally {
    if (db) db.close();
  }
};
