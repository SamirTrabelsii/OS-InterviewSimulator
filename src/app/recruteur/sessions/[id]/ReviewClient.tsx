"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { grille } from "@content/grille";
import { evaluate } from "@/engine/grille/adequation";
import type { Note } from "@/engine/grille/types";
import { durationOf, stateAt, timeline, type Marker, type ReplayEvent } from "@/engine/replay";
import { PixelBar, PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import { PixelAvatar } from "@/ui/pixel/control/Avatar";
import { GemRow } from "@/ui/pixel/control/Gems";
import "@/ui/pixel/control/review.css";
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
const SESSION_STATUS: Record<string, string> = { en_attente: "En attente", en_cours: "En cours", terminee: "Terminée", expiree: "Retiré (solo)" };

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
  const rated = grille.competences.filter((c) => grid[c.id] !== undefined).length;

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

  if (error) return <PixelStatus tone="bad">{error}</PixelStatus>;
  if (!data) return <p className="rc-sub">Chargement du replay…</p>;

  const current = state.code[tab];
  const activeIndex = markers.findLastIndex((m) => m.t <= t);

  return (
    <div className="rv">
      {/* ------------------------------------------------ replay */}
      <section className="rv-col" aria-label="Replay">
        <header className="rv-head">
          <PixelAvatar seed={data.sessionId} size={8} />
          <div className="rv-head-txt">
            <h1 className="rc-h1 rv-name">{data.candidateName}</h1>
            <p className="rc-sub">
              {data.scenario} · {data.mode === "solo" ? "Solo" : "Binôme"} · {SESSION_STATUS[data.status] ?? data.status}
              {data.startedAt ? "" : " · session non démarrée"}
            </p>
          </div>
          <GemRow gems={data.gems} />
        </header>

        <PixelPanel title="Lecture" className="rv-transport">
          <div className="rv-transport-row">
            <PixelButton
              className="px-btn-sm"
              onClick={() => {
                if (!playing && t >= duration) setT(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? "Pause" : "Lecture"}
            </PixelButton>
            <label className="rv-field">
              Vitesse
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rv-select">
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    ×{s}
                  </option>
                ))}
              </select>
            </label>
            <span className="rv-time" aria-label="Position dans le replay">
              {fmt(t)} / {fmt(duration)}
            </span>
          </div>
          <div className="rv-scrub">
            <input type="range" min={0} max={duration} step={100} value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="Position dans le replay" />
            {/* repères sur la frise */}
            <div aria-hidden className="rv-marks">
              {markers
                .filter((m) => m.kind === "gemme" || m.kind === "portail" || m.kind === "systeme")
                .map((m) => (
                  <span key={m.seq} title={`${fmt(m.t)} ${m.label}`} style={{ left: `${duration > 0 ? (m.t / duration) * 100 : 0}%` }} data-kind={m.kind} />
                ))}
            </div>
          </div>
        </PixelPanel>

        <dl className="rv-stats">
          <Stat label="Écran" value={state.stage ? (STAGE_NAME[state.stage] ?? state.stage) : "—"} />
          <Stat label="Gemmes" value={`${state.gems.length}/4`} />
          <Stat label="Onglet" value={state.focusLost ? "quitté" : "actif"} warn={state.focusLost} sub={`${state.focusLostCount} sortie(s)`} />
          <Stat label="Portail" value={state.portail.solved ? "franchi" : state.portail.open ? "ouvert" : "fermé"} sub={state.portail.role ?? undefined} />
        </dl>

        <PixelPanel title="Code du candidat" className="rv-code">
          <div role="tablist" className="rv-tabs">
            {CODE_TABS.map((c) => (
              <button key={c.id} role="tab" type="button" aria-selected={tab === c.id} onClick={() => setTab(c.id)}>
                {c.label}
                {state.results[c.id] && (
                  <span className="rv-tab-n">
                    {state.results[c.id].passed}/{state.results[c.id].total}
                  </span>
                )}
              </button>
            ))}
          </div>
          <ReplayCode value={current?.code ?? ""} language={CODE_TABS.find((c) => c.id === tab)!.language} height={300} />
          <p className="rv-caption">
            {current ? `Version de ${fmt(current.t)} (${current.source === "snapshot" ? "instantané" : current.source === "run" ? "exécution" : "soumission"})` : "Pas encore de code à cet instant."}
            {state.counts[tab] ? ` · ${state.counts[tab].runs} exécution(s), ${state.counts[tab].submits} soumission(s)` : ""}
          </p>
        </PixelPanel>

        {quiz && <QuizCorrection payload={quiz.payload} />}

        <PixelPanel title="Événements" className="rv-events">
          <ol>
            {markers.map((m, i) => (
              <li key={m.seq}>
                <button type="button" onClick={() => seek(m.t)} aria-current={i === activeIndex} data-future={m.t > t}>
                  <span className="rv-ev-t">{fmt(m.t)}</span>
                  <span>{m.label}</span>
                  {m.detail && <span className="rv-ev-d">{m.detail}</span>}
                </button>
              </li>
            ))}
            {markers.length === 0 && <li className="rv-empty">Aucun événement enregistré.</li>}
          </ol>
        </PixelPanel>
      </section>

      {/* ------------------------------------------------ grille */}
      <section className="rv-col rv-grid" aria-label="Grille de compétences">
        <div className="rv-grid-top">
          <h2 className="rc-label">Grille de compétences · {rated}/{grille.competences.length} notées</h2>
          <p className="rv-hint">Notez seul avant toute discussion. « Marquer » rattache la note à l&apos;instant du replay. Le candidat ne voit jamais ces notes.</p>

          {result.nonRetenu && <PixelStatus tone="bad">Non retenu — {result.motifs.join(" ; ")}</PixelStatus>}
          <PixelPanel title="Adéquation par profil" tone={result.nonRetenu ? "magenta" : "cyan"} className="rv-fit">
            <ul>
              {result.adequations.map((a) => (
                <li key={a.profil}>
                  <span className="rv-fit-name">{a.nom}</span>
                  <PixelBar value={(a.pourcentage ?? 0) / 100} segments={20} label={`Adéquation ${a.nom}`} />
                  <span className="rv-fit-pct">{a.pourcentage === null ? "—" : `${a.pourcentage} %`}</span>
                </li>
              ))}
            </ul>
          </PixelPanel>
        </div>

        <ul className="rv-comps">
          {grille.competences.map((c) => {
            const e = grid[c.id];
            return (
              <li key={c.id}>
                <PixelPanel className="rv-comp" tone={e?.note ? "cyan" : "violet"}>
                  <div className="rv-comp-head">
                    <p className="rv-comp-name">{c.nom}</p>
                    {c.eliminatoireSous && <span className="rc-badge" data-tone="magenta">éliminatoire sous {c.eliminatoireSous}</span>}
                  </div>
                  <p className="rv-observe">{c.observer}</p>
                  <div role="radiogroup" aria-label={`Note : ${c.nom}`} className="rv-notes">
                    {([1, 2, 3, 4] as const).map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={e?.note === n} title={c.niveaux[n - 1]} onClick={() => setEntry(c.id, { note: n })}>
                        {n}
                      </button>
                    ))}
                    <button type="button" role="radio" aria-checked={e !== undefined && e.note === null} onClick={() => setEntry(c.id, { note: null })} className="rv-notes-none">
                      Non observé
                    </button>
                  </div>
                  <ol className="rv-levels">
                    {c.niveaux.map((txt, i) => (
                      <li key={i} data-on={e?.note === i + 1}>
                        <b>{i + 1}</b> {txt}
                      </li>
                    ))}
                  </ol>
                  <div className="rv-why">
                    <PixelButton className="px-btn-sm" onClick={() => setEntry(c.id, { moment: t })}>
                      Marquer {fmt(t)}
                    </PixelButton>
                    {e?.moment != null && (
                      <button type="button" onClick={() => seek(e.moment!)} className="rc-link">
                        Aller à {fmt(e.moment)}
                      </button>
                    )}
                    <input
                      value={e?.why ?? ""}
                      maxLength={500}
                      onChange={(ev) => setEntry(c.id, { why: ev.target.value })}
                      placeholder="Justification (moment précis du replay)"
                      aria-label={`Justification : ${c.nom}`}
                      className="rv-input"
                    />
                  </div>
                </PixelPanel>
              </li>
            );
          })}
        </ul>

        <label className="rv-comment">
          <span className="rc-label">Commentaire</span>
          <textarea
            value={comment}
            maxLength={4000}
            rows={4}
            onChange={(e) => {
              setSaved("idle");
              setComment(e.target.value);
            }}
            className="rv-input"
          />
        </label>

        <div className="rv-save">
          <PixelButton variant="primary" onClick={() => void save()} disabled={saved === "saving"}>
            Enregistrer ma notation
          </PixelButton>
          <span role="status" className="rv-save-msg" data-state={saved}>
            {saved === "ok" && "Enregistré."}
            {saved === "error" && "Échec de l'enregistrement."}
          </span>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rv-stat" data-warn={warn ? "true" : undefined}>
      <dt className="rc-label">{label}</dt>
      <dd>{value}</dd>
      {sub && <dd className="rv-stat-sub">{sub}</dd>}
    </div>
  );
}

/** Correction du quiz : visible du recruteur seulement. */
function QuizCorrection({ payload }: { payload: Record<string, unknown> }) {
  const details = (payload.details ?? {}) as Record<string, { given: string; expected: string; ok: boolean }>;
  return (
    <details className="rv-quiz">
      <summary>
        Correction du quiz : {String(payload.correct)} / {String(payload.total)}
      </summary>
      <ul>
        {Object.entries(details).map(([q, d]) => (
          <li key={q} data-ok={d.ok}>
            {q} : {d.given} {d.ok ? "✓" : `✗ (attendu ${d.expected})`}
          </li>
        ))}
      </ul>
    </details>
  );
}
