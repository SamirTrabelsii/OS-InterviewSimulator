"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MapSpot } from "@/engine/recruteur/live";
import { usePortal } from "@/app/session/portail/usePortal";
import { PortalChat } from "@/app/session/portail/PortalChat";
import { PixelButton, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import { PixelAvatar } from "@/ui/pixel/control/Avatar";
import { GemRow } from "@/ui/pixel/control/Gems";
import { LiveMap } from "@/ui/pixel/control/LiveMap";
import "@/ui/pixel/control/review.css";
import { LiveRefresh } from "../../../LiveRefresh";
import { switchToSoloAction } from "../../../actions";

type Candidate = { sessionId: string; name: string; status: string; gems: string[]; started: boolean; spot: MapSpot | null };

const PHASE: Record<string, string> = { ferme: "Portail fermé (gemmes en cours)", ouvert: "Portail ouvert", resolu: "Portail résolu", termine: "Temps écoulé" };
const STATUS: Record<string, string> = { en_attente: "En attente", en_cours: "En cours", terminee: "Terminée", expiree: "Retiré (solo)" };
const SPOT: Record<MapSpot, string> = { hub: "sur la place", quiz: "au Savoir (quiz)", sql: "aux Archives (SQL)", algo: "au Calcul (algo)", logique: "à l'Intuition (logique)", portail: "au Portail" };
const GEMS = ["quiz", "sql", "algo", "logique"] as const;

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

  // Gemmes affichées sur la carte : celles que tous les candidats actifs ont.
  const shared = GEMS.filter((g) => active.length > 0 && active.every((c) => c.gems.includes(g)));
  const portalOpen = view?.phase === "ouvert" || view?.phase === "resolu";

  return (
    <section className="ob">
      <header className="rc-page-head">
        <div>
          <h1 className="rc-h1">Observation du Portail</h1>
          <p className="rc-sub">Salle de contrôle en direct : tout est en lecture seule.</p>
        </div>
        <div className="ob-badges">
          <span className="rc-badge" data-tone={link === "ok" ? "green" : "amber"}>
            <span className="rc-dot" aria-hidden />
            {link === "ok" ? "Connecté en direct" : link === "connexion" ? "Connexion…" : "Connexion perdue, reconnexion…"}
          </span>
          {view && (
            <span className="rc-badge" data-tone={portalOpen ? "cyan" : "mute"}>
              {PHASE[view.phase]}
            </span>
          )}
        </div>
      </header>

      <div className="ob-top">
        <PixelPanel title="Quartier" className="ob-map">
          <LiveMap
            pins={candidates.map((c) => ({ sessionId: c.sessionId, name: c.name, spot: c.spot }))}
            done={shared}
            portalOpen={portalOpen}
            label={`Mini-carte : ${candidates.map((c) => `${c.name} ${c.spot ? SPOT[c.spot] : "hors du quartier"}`).join(" ; ")}`}
          />
        </PixelPanel>

        <ul className="ob-cands">
          {candidates.map((c) => {
            const player = view?.players?.find((p) => p.id === c.sessionId);
            return (
              <li key={c.sessionId}>
                <PixelPanel tone={c.status === "en_cours" ? "green" : "violet"} className="ob-cand">
                  <div className="ob-cand-head">
                    <PixelAvatar seed={c.sessionId} />
                    <div className="ob-cand-txt">
                      <p className="rv-comp-name">
                        {c.name}
                        {player && <span className="ob-role">{player.role}</span>}
                      </p>
                      <p className="rv-observe">
                        {STATUS[c.status] ?? c.status} · {c.spot ? SPOT[c.spot] : "—"} · {player ? (player.online ? "connecté au Portail" : "hors ligne") : "—"}
                      </p>
                    </div>
                    <GemRow gems={c.gems} />
                  </div>
                  {started && active.length > 1 && c.status !== "expiree" && c.started && (
                    <PixelButton className="px-btn-sm" disabled={pending} onClick={() => solo(c)}>
                      Poursuivre seul avec {c.name}
                    </PixelButton>
                  )}
                </PixelPanel>
              </li>
            );
          })}
        </ul>
      </div>

      {message && <PixelStatus>{message}</PixelStatus>}
      {!started && <PixelStatus tone="warn">Le créneau n&apos;a pas encore démarré.</PixelStatus>}
      {view?.phase === "ferme" && <PixelStatus>Le Portail s&apos;ouvrira quand tous les candidats auront leurs 4 gemmes, au plus tard à T0 + 33 min.</PixelStatus>}

      {view && (view.phase === "ouvert" || view.phase === "resolu") && (
        <div className="ob-portal">
          <PixelPanel title={`Code en direct${view.result ? ` · ${view.result.passed} / ${view.result.total}` : ""}`} tone="magenta">
            <pre aria-label="Code en direct" className="ob-pre ob-pre-tall">
              {liveCode ?? view.code}
            </pre>
          </PixelPanel>
          <div className="ob-side">
            <PixelPanel title="Contexte client" tone="amber">
              <p className="ob-context">{view.clientContext}</p>
            </PixelPanel>
            <PixelPanel title="Logs vus par le copilote">
              <pre aria-label="Logs" className="ob-pre">
                {(view.logs ?? []).join("\n")}
              </pre>
            </PixelPanel>
          </div>
        </div>
      )}

      {view?.chat && view.chat.length > 0 && <PortalChat chat={view.chat} />}

      {/* Positions des candidats sur la carte : rechargées toutes les 10 s. */}
      <LiveRefresh everyMs={10_000} />
    </section>
  );
}
