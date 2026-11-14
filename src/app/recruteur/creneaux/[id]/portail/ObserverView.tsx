"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { usePortal } from "@/app/session/portail/usePortal";
import { switchToSoloAction } from "../../../actions";

type Candidate = { sessionId: string; name: string; status: string; gems: number; started: boolean };

const PHASE: Record<string, string> = { ferme: "Portail fermé (gemmes en cours)", ouvert: "Portail ouvert", resolu: "Portail résolu", termine: "Temps écoulé" };
const STATUS: Record<string, string> = { en_attente: "En attente", en_cours: "En cours", terminee: "Terminée", expiree: "Retiré (solo)" };

/** Observation en direct, en lecture seule : tout est visible, rien n'est modifiable ici. */
export function ObserverView({ slotId, started, candidates }: { slotId: string; started: boolean; candidates: Candidate[] }) {
  const { view, link, liveCode } = usePortal(slotId);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const active = candidates.filter((c) => c.status !== "expiree");
  const solo = (keep: Candidate) => {
    const other = active.find((c) => c.sessionId !== keep.sessionId);
    if (!window.confirm(`Faire poursuivre ${keep.name} seul${other ? ` et retirer ${other.name}` : ""} ? Cette décision est définitive pour ce créneau.`)) return;
    start(async () => {
      const r = await switchToSoloAction(slotId, keep.sessionId);
      setMessage(r.status === "error" ? r.message : "Repli solo effectué.");
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Observation du Portail</h1>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {link === "ok" ? "Connecté en direct" : link === "connexion" ? "Connexion…" : "Connexion perdue, reconnexion…"}
          {view ? ` · ${PHASE[view.phase]}` : ""}
        </span>
      </header>

      <ul className="flex flex-wrap gap-3">
        {candidates.map((c) => {
          const player = view?.players?.find((p) => p.id === c.sessionId);
          return (
            <li key={c.sessionId} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <p className="font-medium">
                {c.name}
                {player && <span className="ml-2 text-xs">{player.role}</span>}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {STATUS[c.status] ?? c.status} · {c.gems}/4 gemmes · {player ? (player.online ? "connecté au Portail" : "hors ligne") : "—"}
              </p>
              {started && active.length > 1 && c.status !== "expiree" && c.started && (
                <button disabled={pending} onClick={() => solo(c)} className="mt-2 text-xs underline disabled:opacity-50">
                  Poursuivre seul avec {c.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      {!started && <p className="text-zinc-600 dark:text-zinc-400">Le créneau n&apos;a pas encore démarré.</p>}
      {view?.phase === "ferme" && (
        <p className="text-zinc-600 dark:text-zinc-400">Le Portail s&apos;ouvrira quand tous les candidats auront leurs 4 gemmes, au plus tard à T0 + 33 min.</p>
      )}

      {view && (view.phase === "ouvert" || view.phase === "resolu") && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h2 className="flex items-baseline justify-between font-medium">
              <span>Code en direct</span>
              {view.result && (
                <span className="font-mono">
                  {view.result.passed} / {view.result.total}
                </span>
              )}
            </h2>
            <pre aria-label="Code en direct" className="max-h-[32rem] overflow-auto rounded-md bg-zinc-900 p-3 font-mono text-xs text-zinc-100">
              {liveCode ?? view.code}
            </pre>
          </div>
          <div className="space-y-2">
            <h2 className="font-medium">Contexte client</h2>
            <p className="rounded-lg border-l-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm dark:bg-sky-950">{view.clientContext}</p>
            <h2 className="font-medium">Logs vus par le copilote</h2>
            <pre aria-label="Logs" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-900 p-3 font-mono text-xs text-zinc-100">
              {(view.logs ?? []).join("\n")}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
