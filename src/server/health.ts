export type HealthReport = {
  status: "ok" | "degrade";
  db: "ok" | "erreur";
  durationMs: number;
};

/**
 * Vérifie l'état du service. La sonde base de données est injectée pour
 * pouvoir tester sans PostgreSQL. Aucun détail d'erreur n'est renvoyé au
 * client (il pourrait contenir l'URL de connexion) : il est seulement loggé.
 */
export async function checkHealth(
  pingDb: () => Promise<unknown>,
  timeoutMs = 3000,
): Promise<HealthReport> {
  const start = performance.now();
  let db: HealthReport["db"] = "ok";
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      pingDb(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("délai dépassé")), timeoutMs);
      }),
    ]);
  } catch (err) {
    db = "erreur";
    console.error("[health] base de données injoignable:", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timer);
  }
  return {
    status: db === "ok" ? "ok" : "degrade",
    db,
    durationMs: Math.round(performance.now() - start),
  };
}
