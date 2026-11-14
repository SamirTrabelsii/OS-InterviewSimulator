// Replay : reconstruction de l'état d'une session à un instant t, depuis le
// journal `events` (voir docs/ARCHITECTURE.md § 3.11). Fonctions pures, sans
// accès à la base : tout est testable avec une liste d'événements.

export type ReplayEvent = {
  seq: number;
  /** Millisecondes écoulées depuis le début de la session (T0 de la session). */
  t: number;
  actor: "candidat" | "systeme" | "recruteur";
  type: string;
  payload: Record<string, unknown>;
};

export type CodeVersion = { code: string; t: number; source: "snapshot" | "run" | "submit" };
export type StageResult = { passed: number; total: number; t: number };

export type ReplayState = {
  t: number;
  /** Écran affiché (accueil, hub, quiz, sql, algo, logique, portail, fin), null si inconnu. */
  stage: string | null;
  /** Dernière version du code vue par épreuve (sql, algo, portail). */
  code: Record<string, CodeVersion>;
  /** Gemmes obtenues, dans l'ordre. */
  gems: { gem: string; t: number }[];
  /** Dernier résultat « X / Y » par épreuve. */
  results: Record<string, StageResult>;
  /** Nombre d'essais / soumissions / exécutions par épreuve. */
  counts: Record<string, { submits: number; runs: number }>;
  /** Hors de l'application (onglet masqué) à cet instant. */
  focusLost: boolean;
  focusLostCount: number;
  /** Quiz : réponses choisies jusque-là (brouillon, dernière valeur par question). */
  quizDraft: Record<string, string>;
  portail: { open: boolean; solved: boolean; ended: boolean; role: string | null };
  ended: boolean;
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Ordre stable : par instant puis par numéro de séquence. */
export function sortEvents<T extends Pick<ReplayEvent, "t" | "seq">>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => a.t - b.t || a.seq - b.seq);
}

/** État à l'instant `t` (inclus) : tous les événements postérieurs sont ignorés. */
export function stateAt(events: readonly ReplayEvent[], t: number): ReplayState {
  const s: ReplayState = {
    t,
    stage: null,
    code: {},
    gems: [],
    results: {},
    counts: {},
    focusLost: false,
    focusLostCount: 0,
    quizDraft: {},
    portail: { open: false, solved: false, ended: false, role: null },
    ended: false,
  };
  const count = (stage: string) => (s.counts[stage] ??= { submits: 0, runs: 0 });

  for (const e of sortEvents(events)) {
    if (e.t > t) break;
    const p = e.payload;
    switch (e.type) {
      case "stage.enter":
        s.stage = str(p.stage);
        break;
      case "stage.leave":
        if (s.stage === str(p.stage)) s.stage = null;
        break;
      case "focus.lost":
        s.focusLost = true;
        s.focusLostCount++;
        break;
      case "focus.gained":
        s.focusLost = false;
        break;
      case "code.snapshot": {
        const stage = str(p.stage);
        const code = str(p.code);
        if (stage && code !== null) s.code[stage] = { code, t: e.t, source: "snapshot" };
        break;
      }
      case "code.run": {
        const stage = str(p.stage);
        const code = str(p.code) ?? str(p.query);
        if (stage) {
          count(stage).runs++;
          if (code !== null) s.code[stage] = { code, t: e.t, source: "run" };
        }
        break;
      }
      case "sql.submit":
      case "algo.submit": {
        const stage = e.type.slice(0, e.type.indexOf("."));
        count(stage).submits++;
        const code = str(p.query) ?? str(p.code);
        if (code !== null) s.code[stage] = { code, t: e.t, source: "submit" };
        break;
      }
      case "logique.attempt":
        count("logique").submits++;
        break;
      case "quiz.submit":
        count("quiz").submits++;
        break;
      case "answer.change": {
        const q = str(p.question);
        const c = str(p.choice);
        if (q && c) s.quizDraft[q] = c;
        break;
      }
      case "sql.result":
      case "algo.result":
      case "portail.result": {
        const passed = num(p.passed);
        const total = num(p.total);
        if (passed !== null && total !== null) s.results[e.type.slice(0, e.type.indexOf("."))] = { passed, total, t: e.t };
        break;
      }
      case "quiz.result": {
        const passed = num(p.correct);
        const total = num(p.total);
        if (passed !== null && total !== null) s.results.quiz = { passed, total, t: e.t };
        break;
      }
      case "gem.obtained": {
        const gem = str(p.gem);
        if (gem && !s.gems.some((g) => g.gem === gem)) s.gems.push({ gem, t: e.t });
        break;
      }
      case "portail.open":
        s.portail.open = true;
        break;
      case "portail.role":
        s.portail.role = str(p.role);
        break;
      case "portail.run": {
        count("portail").runs++;
        const code = str(p.code);
        if (code !== null) s.code.portail = { code, t: e.t, source: "run" };
        break;
      }
      case "portail.solved":
        s.portail.solved = true;
        break;
      case "portail.end":
        s.portail.ended = true;
        break;
      case "session.end":
        s.ended = true;
        break;
    }
  }
  return s;
}

// ---------------------------------------------------------------- frise

export type Marker = { t: number; seq: number; kind: "etape" | "soumission" | "gemme" | "portail" | "focus" | "systeme"; label: string; detail?: string };

const STAGE_LABEL: Record<string, string> = {
  accueil: "Accueil",
  hub: "Hub des gemmes",
  quiz: "Quiz",
  sql: "SQL",
  algo: "Algo Python",
  logique: "Logique",
  portail: "Portail",
  fin: "Fin",
};
const stageLabel = (s: unknown) => (typeof s === "string" ? (STAGE_LABEL[s] ?? s) : "?");
const ratio = (p: Record<string, unknown>) => (num(p.passed) !== null && num(p.total) !== null ? `${p.passed} / ${p.total}` : undefined);

/** Repères de la frise : les événements utiles au recruteur, dans l'ordre. */
export function timeline(events: readonly ReplayEvent[]): Marker[] {
  const out: Marker[] = [];
  for (const e of sortEvents(events)) {
    const p = e.payload;
    const add = (kind: Marker["kind"], label: string, detail?: string) => out.push({ t: e.t, seq: e.seq, kind, label, ...(detail ? { detail } : {}) });
    switch (e.type) {
      case "session.start":
        add("systeme", "Début de la session");
        break;
      case "session.end":
        add("systeme", "Fin de la session", str(p.reason) ?? undefined);
        break;
      case "stage.enter":
        add("etape", `Entrée : ${stageLabel(p.stage)}`);
        break;
      case "code.run":
        add("soumission", `Exécution ${stageLabel(p.stage)}`, str(p.error) ?? ratio(p));
        break;
      case "sql.submit":
      case "algo.submit":
        add("soumission", `Soumission ${stageLabel(e.type.slice(0, e.type.indexOf(".")))}`);
        break;
      case "sql.result":
      case "algo.result":
        add("soumission", `Résultat ${stageLabel(e.type.slice(0, e.type.indexOf(".")))}`, ratio(p));
        break;
      case "quiz.submit":
        add("soumission", "Quiz envoyé");
        break;
      case "logique.attempt":
        add("soumission", p.ok === true ? "Logique : bonne réponse" : "Logique : essai manqué");
        break;
      case "gem.obtained":
        add("gemme", `Gemme obtenue : ${stageLabel(p.gem)}`);
        break;
      case "focus.lost":
        add("focus", "Onglet quitté");
        break;
      case "focus.gained":
        add("focus", "Retour sur l'onglet");
        break;
      case "portail.open":
        add("portail", "Ouverture du Portail", p.forced === true ? "forcée (temps)" : undefined);
        break;
      case "portail.role":
        add("portail", `Rôle : ${str(p.role) ?? "?"}`);
        break;
      case "portail.run":
        add("portail", "Exécution au Portail");
        break;
      case "portail.result":
        add("portail", "Résultat du Portail", ratio(p));
        break;
      case "portail.solved":
        add("portail", "Portail franchi");
        break;
      case "portail.main.demande":
        add("portail", "Demande de la main");
        break;
      case "portail.main.accord":
        add("portail", "Main accordée");
        break;
      case "portail.main.refus":
        add("portail", "Main refusée");
        break;
      case "portail.main.prise":
        add("portail", "Main prise");
        break;
      case "portail.solo":
        add("portail", "Repli solo par le recruteur");
        break;
    }
  }
  return out;
}

/** Durée utile du replay : dernier événement (au moins 1 s pour une barre utilisable). */
export function durationOf(events: readonly ReplayEvent[]): number {
  return Math.max(1000, ...events.map((e) => e.t));
}
