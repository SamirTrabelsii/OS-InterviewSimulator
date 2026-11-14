"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { grille } from "@content/grille";
import { evaluate } from "@/engine/grille/adequation";
import type { Note } from "@/engine/grille/types";
import { durationOf, stateAt, timeline, type Marker, type ReplayEvent } from "@/engine/replay";
import { ReplayCode } from "./ReplayCode";

type ReplayData = {
  sessionId: string;
  candidateName: string;
  scenario: string;
  mode: "solo" | "binome";
  status: string;
  gems: string[];
  startedAt: string | null;
  events: ReplayEvent[];
};
type Entry = { note: Note; moment: number | null; why: string };
type Grid = Record<string, Entry>;

const SPEEDS = [1, 4, 16, 64];
const CODE_TABS: { id: string; label: string; language: "sql" | "python" }[] = [
  { id: "sql", label: "SQL", language: "sql" },
  { id: "algo", label: "Algo", language: "python" },
  { id: "portail", label: "Portail", language: "python" },
];
const STAGE_NAME: Record<string, string> = { quiz: "Quiz", sql: "SQL", algo: "Algo", logique: "Logique", portail: "Portail" };

export function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function ReviewClient({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid>({});
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [tab, setTab] = useState("sql");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, e] = await Promise.all([
          fetch(`/api/recruteur/sessions/${sessionId}/replay`),
          fetch(`/api/recruteur/sessions/${sessionId}/evaluation`),
        ]);
        if (!r.ok) throw new Error(r.status === 404 ? "Session introuvable." : "Replay indisponible.");
        const replay = (await r.json()) as ReplayData;
        const ev = e.ok ? ((await e.json()) as { evaluation: { grid: Grid; comment: string } | null }).evaluation : null;
        if (cancelled) return;
        setData(replay);
        if (ev) {
          setGrid(ev.grid);
          setComment(ev.comment);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur inconnue.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const events = useMemo(() => data?.events ?? [], [data]);
  const duration = useMemo(() => durationOf(events), [events]);
  const markers = useMemo<Marker[]>(() => timeline(events), [events]);
  const state = useMemo(() => stateAt(events, t), [events, t]);
  const quiz = useMemo(() => [...events].reverse().find((e) => e.type === "quiz.result" && e.t <= t), [events, t]);

  // Lecture : l'horloge avance de `speed` × le temps réel.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = Math.min(duration, tRef.current + 100 * speed);
      setT(next);
      if (next >= duration) setPlaying(false);
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed, duration]);

  const seek = useCallback((ms: number) => setT(Math.max(0, Math.min(duration, ms))), [duration]);

  const notes = useMemo(() => Object.fromEntries(Object.entries(grid).map(([k, v]) => [k, v.note])), [grid]);
  const result = useMemo(() => evaluate(grille, notes), [notes]);

  function setEntry(id: string, patch: Partial<Entry>) {
    setSaved("idle");
    setGrid((g) => ({ ...g, [id]: { ...({ note: null, moment: null, why: "" } as Entry), ...g[id], ...patch } }));
  }

  async function save() {
    setSaved("saving");
    const res = await fetch(`/api/recruteur/sessions/${sessionId}/evaluation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grid, comment }),
    });
    setSaved(res.ok ? "ok" : "error");
  }

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!data) return <p className="text-zinc-500">Chargement du replay…</p>;

  const current = state.code[tab];
  const activeIndex = markers.findLastIndex((m) => m.t <= t);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* ------------------------------------------------ replay */}
      <section className="min-w-0 space-y-4" aria-label="Replay">
        <header>
          <h1 className="text-2xl font-semibold">{data.candidateName}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {data.scenario} · {data.mode === "solo" ? "Solo" : "Binôme"} · {data.status} · {data.gems.length}/4 gemmes
            {data.startedAt ? "" : " · session non démarrée"}
          </p>
        </header>

        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!playing && t >= duration) setT(0);
                setPlaying((p) => !p);
              }}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {playing ? "Pause" : "Lecture"}
            </button>
            <label className="flex items-center gap-1 text-sm">
              Vitesse
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700">
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    ×{s}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-sm tabular-nums">
              {fmt(t)} / {fmt(duration)}
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={0}
              max={duration}
              step={100}
              value={t}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Position dans le replay"
              className="w-full"
            />
            {/* repères sur la frise */}
            <div aria-hidden className="pointer-events-none relative -mt-1 h-3">
              {markers
                .filter((m) => m.kind === "gemme" || m.kind === "portail" || m.kind === "systeme")
                .map((m) => (
                  <span
                    key={m.seq}
                    title={`${fmt(m.t)} ${m.label}`}
                    style={{ left: `${(m.t / duration) * 100}%` }}
                    className={`absolute top-0 h-3 w-0.5 ${m.kind === "gemme" ? "bg-amber-500" : m.kind === "portail" ? "bg-indigo-500" : "bg-zinc-400"}`}
                  />
                ))}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Écran" value={state.stage ? (STAGE_NAME[state.stage] ?? state.stage) : "—"} />
          <Stat label="Gemmes" value={`${state.gems.length}/4`} />
          <Stat label="Onglet" value={state.focusLost ? "quitté" : "actif"} warn={state.focusLost} sub={`${state.focusLostCount} sortie(s)`} />
          <Stat label="Portail" value={state.portail.solved ? "franchi" : state.portail.open ? "ouvert" : "fermé"} sub={state.portail.role ?? undefined} />
        </dl>

        <div className="space-y-2">
          <div role="tablist" className="flex gap-1">
            {CODE_TABS.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={tab === c.id}
                onClick={() => setTab(c.id)}
                className={`rounded-md px-3 py-1 text-sm ${tab === c.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 dark:border-zinc-700"}`}
              >
                {c.label}
                {state.results[c.id] && (
                  <span className="ml-1 opacity-70">
                    {state.results[c.id].passed}/{state.results[c.id].total}
                  </span>
                )}
              </button>
            ))}
          </div>
          <ReplayCode value={current?.code ?? ""} language={CODE_TABS.find((c) => c.id === tab)!.language} />
          <p className="text-xs text-zinc-500">
            {current ? `Version de ${fmt(current.t)} (${current.source === "snapshot" ? "instantané" : current.source === "run" ? "exécution" : "soumission"})` : "Pas encore de code à cet instant."}
            {state.counts[tab] ? ` · ${state.counts[tab].runs} exécution(s), ${state.counts[tab].submits} soumission(s)` : ""}
          </p>
        </div>

        {quiz && <QuizCorrection payload={quiz.payload} />}

        <div className="space-y-1">
          <h2 className="text-sm font-medium">Événements</h2>
          <ol className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-md border border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            {markers.map((m, i) => (
              <li key={m.seq}>
                <button
                  type="button"
                  onClick={() => seek(m.t)}
                  aria-current={i === activeIndex}
                  className={`flex w-full items-baseline gap-3 px-2 py-1 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900 ${i === activeIndex ? "bg-indigo-50 dark:bg-indigo-950" : ""} ${m.t > t ? "opacity-50" : ""}`}
                >
                  <span className="font-mono text-xs tabular-nums text-zinc-500">{fmt(m.t)}</span>
                  <span>{m.label}</span>
                  {m.detail && <span className="text-xs text-zinc-500">{m.detail}</span>}
                </button>
              </li>
            ))}
            {markers.length === 0 && <li className="px-2 py-2 text-zinc-500">Aucun événement enregistré.</li>}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------ grille */}
      <section className="min-w-0 space-y-4" aria-label="Grille de compétences">
        <h2 className="text-xl font-semibold">Grille de compétences</h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Notez seul avant toute discussion. Appuyez sur « Marquer » pour rattacher la note à l&apos;instant du replay. Le candidat ne voit jamais ces notes.
        </p>

        <div className={`rounded-lg border p-3 ${result.nonRetenu ? "border-red-400 bg-red-50 dark:bg-red-950" : "border-zinc-200 dark:border-zinc-800"}`}>
          {result.nonRetenu && (
            <p role="alert" className="mb-2 font-medium text-red-700 dark:text-red-300">
              Non retenu — {result.motifs.join(" ; ")}
            </p>
          )}
          <ul className="space-y-1 text-sm">
            {result.adequations.map((a) => (
              <li key={a.profil} className="flex items-center gap-2">
                <span className="w-28 shrink-0">{a.nom}</span>
                <span className="h-2 flex-1 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                  <span className="block h-full bg-indigo-500" style={{ width: `${a.pourcentage ?? 0}%` }} />
                </span>
                <span className="w-12 text-right tabular-nums">{a.pourcentage === null ? "—" : `${a.pourcentage} %`}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="space-y-3">
          {grille.competences.map((c) => {
            const e = grid[c.id];
            return (
              <li key={c.id} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div>
                  <p className="font-medium">
                    {c.nom}
                    {c.eliminatoireSous && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800 dark:bg-red-900 dark:text-red-100">éliminatoire sous {c.eliminatoireSous}</span>}
                  </p>
                  <p className="text-xs text-zinc-500">{c.observer}</p>
                </div>
                <div role="radiogroup" aria-label={`Note : ${c.nom}`} className="flex flex-wrap gap-1">
                  {([1, 2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={e?.note === n}
                      title={c.niveaux[n - 1]}
                      onClick={() => setEntry(c.id, { note: n })}
                      className={`h-8 w-8 rounded-md border text-sm ${e?.note === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={e !== undefined && e.note === null}
                    onClick={() => setEntry(c.id, { note: null })}
                    className={`rounded-md border px-2 text-sm ${e !== undefined && e.note === null ? "border-zinc-700 bg-zinc-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
                  >
                    Non observé
                  </button>
                </div>
                <ol className="space-y-0.5 text-xs">
                  {c.niveaux.map((txt, i) => (
                    <li key={i} className={e?.note === i + 1 ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-zinc-500"}>
                      {i + 1}. {txt}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setEntry(c.id, { moment: t })} className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
                    Marquer {fmt(t)}
                  </button>
                  {e?.moment != null && (
                    <button type="button" onClick={() => seek(e.moment!)} className="text-xs underline">
                      Aller à {fmt(e.moment)}
                    </button>
                  )}
                  <input
                    value={e?.why ?? ""}
                    maxLength={500}
                    onChange={(ev) => setEntry(c.id, { why: ev.target.value })}
                    placeholder="Justification (moment précis du replay)"
                    aria-label={`Justification : ${c.nom}`}
                    className="min-w-0 flex-1 rounded border border-zinc-300 bg-transparent px-2 py-0.5 text-xs dark:border-zinc-700"
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <label className="block space-y-1 text-sm">
          Commentaire
          <textarea
            value={comment}
            maxLength={4000}
            rows={4}
            onChange={(e) => {
              setSaved("idle");
              setComment(e.target.value);
            }}
            className="w-full rounded-md border border-zinc-300 bg-transparent p-2 dark:border-zinc-700"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saved === "saving"}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Enregistrer ma notation
          </button>
          <span role="status" className="text-sm">
            {saved === "ok" && "Enregistré."}
            {saved === "error" && <span className="text-red-600">Échec de l&apos;enregistrement.</span>}
          </span>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${warn ? "border-amber-400" : "border-zinc-200 dark:border-zinc-800"}`}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {sub && <dd className="text-xs text-zinc-500">{sub}</dd>}
    </div>
  );
}

/** Correction du quiz : visible du recruteur seulement. */
function QuizCorrection({ payload }: { payload: Record<string, unknown> }) {
  const details = (payload.details ?? {}) as Record<string, { given: string; expected: string; ok: boolean }>;
  return (
    <details className="rounded-md border border-zinc-200 p-2 text-sm dark:border-zinc-800">
      <summary className="cursor-pointer font-medium">
        Correction du quiz : {String(payload.correct)} / {String(payload.total)}
      </summary>
      <ul className="mt-2 space-y-0.5">
        {Object.entries(details).map(([q, d]) => (
          <li key={q} className={d.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
            {q} : {d.given} {d.ok ? "✓" : `✗ (attendu ${d.expected})`}
          </li>
        ))}
      </ul>
    </details>
  );
}
