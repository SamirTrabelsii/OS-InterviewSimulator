// Types échangés entre le parent (pool.ts) et le processus enfant
// (sandbox/child.mjs). Les attendus des tests ne font JAMAIS partie d'une
// tâche : l'enfant ne reçoit que les entrées, la comparaison se fait dans le
// parent (le code candidat ne peut pas lire ce qui n'est pas dans son
// processus).

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export type PythonJob = {
  kind: "python";
  code: string;
  /** Sans `call` : exécute le script et renvoie sa sortie. */
  call?: {
    /** Nom de la fonction du candidat à appeler. */
    fn: string;
    /** Arguments de chaque appel (un espace de noms neuf par appel). */
    cases: JsonValue[][];
  };
  timeoutMs?: number;
};

export type SqlJob = {
  kind: "sql";
  /** Script de création et de remplissage de la base (généré depuis la graine). */
  setup: string;
  /** Requête du candidat : une seule instruction, base en lecture seule. */
  query: string;
  /**
   * Autres bases sur lesquelles exécuter la même requête, dans le même
   * processus (ex. jeu caché) : résultats dans `sqlRuns`, dans l'ordre.
   */
  extraSetups?: string[];
  maxRows?: number;
  timeoutMs?: number;
};

export type SandboxJob = PythonJob | SqlJob;

export type CaseResult =
  | { index: number; durationMs: number; ok: true; value: JsonValue }
  | { index: number; durationMs: number; ok: false; error: string };

export type SqlResult = {
  columns: string[];
  rows: JsonValue[][];
  truncated: boolean;
};

export type SandboxStatus =
  /** Exécution terminée (des cas peuvent avoir échoué individuellement). */
  | "ok"
  /** Erreur du code candidat (syntaxe, exception au niveau du script, SQL invalide). */
  | "error"
  /** Délai dépassé : processus tué. */
  | "timeout"
  /** Mémoire dépassée : processus tué (ou plafond WASM). */
  | "memory"
  /** Trop de données renvoyées par l'enfant : processus tué. */
  | "output_limit"
  /** L'enfant s'est arrêté sans répondre. */
  | "crash"
  /** File d'attente pleine : réessayer plus tard. */
  | "busy";

export type SandboxResult = {
  status: SandboxStatus;
  /** Durée d'exécution de la tâche (hors attente et chargement). */
  durationMs: number;
  /** Sortie standard Python (tronquée). Ne jamais la montrer pour des tests cachés. */
  stdout: string;
  stdoutTruncated: boolean;
  /** Résultats par cas (tâches Python avec `call`), éventuellement partiels. */
  cases: CaseResult[];
  sql?: SqlResult;
  /** Un résultat par base (`setup` puis `extraSetups`) ; `sql` = le premier. */
  sqlRuns?: SqlResult[];
  error?: string;
};

/** Messages de l'enfant vers le parent. */
export type ChildMessage =
  | { type: "ready" }
  | ({ type: "case" } & CaseResult)
  | {
      type: "done";
      status: "ok" | "error";
      error?: string;
      sql?: SqlResult;
      sqlRuns?: SqlResult[];
      stdout: string;
      stdoutTruncated: boolean;
    };
