"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PortalView } from "@/engine/portal";
import { PixelButton, PixelLink, PixelPanel, PixelStatus } from "@/ui/pixel/components";
import { CodeEditor } from "../CodeEditor";
import { EventTracker } from "../EventTracker";
import { reasonText, usePortal, type Link as LinkState } from "./usePortal";

const ROLE_LABEL: Record<string, string> = {
  pilote: "Pilote — vous tenez le clavier",
  copilote: "Copilote — vous guidez avec les logs et le ticket",
  solo: "Solo — vous avez toutes les vues",
};

function Clock({ view, offset }: { view: PortalView; offset: number }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!view.deadline) return;
    const tick = () => {
      const ms = Date.parse(view.deadline!) - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [view.deadline, offset, router]);
  if (left === null) return null;
  const total = Math.max(0, Math.ceil(left / 1000));
  return (
    <span role="timer" className="px-hud-time" data-urgent={total < 300}>
      {String(Math.floor(total / 60)).padStart(2, "0")}:{String(total % 60).padStart(2, "0")}
    </span>
  );
}

function LinkBanner({ link }: { link: LinkState }) {
  if (link === "ok" || link === "connexion") return null;
  const text: Record<string, string> = {
    coupee: "Connexion perdue… reconnexion en cours. Votre travail reste enregistré.",
    remplace: "Cette session s'est ouverte dans un autre onglet ou sur un autre appareil. Utilisez celui-ci ou rechargez la page pour reprendre ici.",
    retire: "Le recruteur a poursuivi cette épreuve sans vous. Merci pour votre participation.",
    refuse: "Accès refusé. Rouvrez votre lien personnel.",
  };
  return (
    <PixelStatus tone="warn" role="alert">
      <p>{text[link]}</p>
    </PixelStatus>
  );
}

function PartnerBadge({ view }: { view: PortalView }) {
  if (!view.partner) return null;
  return (
    <span className="px-pill">
      <span aria-hidden className="px-dot" data-on={view.partner.online} />
      {view.partner.name} · {view.partner.online ? "connecté" : "hors ligne"}
    </span>
  );
}

const show = (v: unknown) => JSON.stringify(v);

export function PortalClient({ epilogue }: { epilogue: string }) {
  const { view, link, send, offset } = usePortal();
  const router = useRouter();

  useEffect(() => {
    if (view?.phase === "termine") router.refresh();
  }, [view?.phase, router]);

  if (!view) {
    return (
      <>
        <EventTracker stage="portail" />
        <LinkBanner link={link} />
        <p className="px-muted" role="status">
          Connexion au Portail…
        </p>
      </>
    );
  }

  return (
    <section className="px-stack">
      <EventTracker stage="portail" />
      <PixelPanel tone="cyan">
        <div className="px-hud">
          <div>
            <PixelLink href="/session" variant="ghost">
              ← Quartier
            </PixelLink>
            <h1 className="px-stage-title" style={{ marginTop: "0.25rem" }}>
              {view.title}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <PartnerBadge view={view} />
            <Clock view={view} offset={offset.current} />
          </div>
        </div>
      </PixelPanel>
      <LinkBanner link={link} />

      {view.phase === "ferme" && <Closed view={view} />}
      {view.phase === "termine" && (
        <PixelPanel tone="violet">
          <p className="px-read" style={{ margin: 0, textAlign: "center" }}>
            Temps écoulé. Merci pour votre participation !
          </p>
        </PixelPanel>
      )}
      {view.phase === "resolu" && (
        <PixelPanel tone="green" glow={3} title="Le Portail s'ouvre !">
          <p className="px-read px-story">{epilogue}</p>
          <p className="px-muted" style={{ marginBottom: 0 }}>
            Le recruteur reviendra vers vous. Vous pouvez fermer cet onglet.
          </p>
        </PixelPanel>
      )}
      {view.phase === "ouvert" && <Open view={view} send={send} link={link} />}
    </section>
  );
}

function Closed({ view }: { view: PortalView }) {
  const latest = view.opensByLatest ? new Date(view.opensByLatest) : null;
  return (
    <PixelPanel tone="violet" glow={1} title="Le Portail s'éveille…">
      <p className="px-read px-story">
        Il s&apos;ouvrira dès que {view.partner ? "vous et votre binôme aurez" : "vous aurez"} les 4 gemmes
        {latest ? `, au plus tard à ${latest.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}.
      </p>
      <div className="px-actions">
        <PixelLink href="/session" variant="primary">
          Retourner chercher les gemmes manquantes
        </PixelLink>
      </div>
    </PixelPanel>
  );
}

type Send = ReturnType<typeof usePortal>["send"];

/**
 * Éditeur du pilote : non contrôlé, recréé (key) à chaque passage de main
 * pour repartir du code du serveur. Envoie le code 150 ms après la
 * dernière frappe et renvoie ce qui n'est pas parti après une coupure.
 */
function PilotEditor({ view, send, link, onNote }: { view: PortalView; send: Send; link: LinkState; onNote: (n: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const local = useRef({ code: view.code ?? "", pending: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const epoch = view.epoch;

  const push = () => {
    const { code } = local.current;
    void send("code:update", { epoch, code }).then((a) => {
      if (a.ok && local.current.code === code) local.current.pending = false;
      else if (!a.ok && a.reason !== "epoque") onNote(reasonText(a));
    });
  };
  const pushRef = useRef(push);
  useEffect(() => {
    pushRef.current = push;
  });

  useEffect(() => {
    if (link === "ok" && local.current.pending) pushRef.current();
  }, [link]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChange = (code: string) => {
    local.current = { code, pending: true };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pushRef.current(), 150);
  };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    onNote(null);
    if (timer.current) clearTimeout(timer.current);
    if (local.current.pending) await send("code:update", { epoch, code: local.current.code });
    const a = await send("run");
    if (!a.ok) onNote(reasonText(a));
    setBusy(false);
  };

  return (
    <PixelPanel tone="magenta" title={`Le code à corriger${view.functionName ? ` — ${view.functionName}` : ""}`}>
      <CodeEditor night language="python" initialValue={view.code ?? ""} onChange={onChange} onRun={run} label="Code Python du Portail" height={420} />
      <div className="px-actions">
        <PixelButton variant="primary" onClick={run} disabled={busy}>
          {busy ? "Vérification…" : "Exécuter et vérifier"}
        </PixelButton>
        <span className="px-muted">Ctrl + Entrée · seul le pilote tape.</span>
      </div>
      {view.role === "pilote" && (
        <PixelStatus>
          <p>Vous ne voyez ni les logs ni le ticket du client : votre copilote les a. Parlez-vous (Teams) !</p>
        </PixelStatus>
      )}
    </PixelPanel>
  );
}

function Open({ view, send, link }: { view: PortalView; send: Send; link: LinkState }) {
  const writer = view.role === "pilote" || view.role === "solo";
  const seesContext = view.role === "copilote" || view.role === "solo";
  const [note, setNote] = useState<string | null>(null);

  const hand = async (event: "hand:request" | "hand:grant" | "hand:deny" | "hand:take") => {
    setNote(null);
    const a = await send(event);
    if (!a.ok) setNote(reasonText(a));
  };

  return (
    <div className="px-stack">
      <div className="px-hud">
        <p className="px-pill">{ROLE_LABEL[view.role]}</p>
        {view.result && (
          <p aria-live="polite" className="px-score">
            {view.result.passed} / {view.result.total}
          </p>
        )}
      </div>
      <PixelPanel tone="cyan">
        <p className="px-read px-story">{view.story}</p>
      </PixelPanel>
      {note && (
        <PixelStatus tone="bad">
          <p>{note}</p>
        </PixelStatus>
      )}

      {view.hand === "recue" && (
        <PixelStatus tone="warn" role="alert">
          <p>Votre binôme demande le clavier.</p>
          <div className="px-actions">
            <PixelButton variant="primary" onClick={() => hand("hand:grant")}>
              Passer la main
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => hand("hand:deny")}>
              Pas maintenant
            </PixelButton>
          </div>
        </PixelStatus>
      )}

      <div className={`px-split ${writer && seesContext ? "px-split-2" : ""}`}>
        {writer && <PilotEditor key={`${view.epoch}-${view.role}`} view={view} send={send} link={link} onNote={setNote} />}

        {seesContext && (
          <div className="px-stack">
            {view.clientContext && (
              <PixelPanel tone="cyan" title="Contexte client">
                <p className="px-read px-story">{view.clientContext}</p>
              </PixelPanel>
            )}
            {view.statement && (
              <PixelPanel tone="green" title="Mission">
                <p className="px-read px-story">{view.statement}</p>
              </PixelPanel>
            )}
            {view.examples && (
              <PixelPanel tone="violet">
                <details className="px-details">
                  <summary>Exemples</summary>
                  <ul className="px-code" style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem" }}>
                    {view.examples.map((ex, i) => (
                      <li key={i}>
                        ({ex.args.map(show).join(", ")}) → {show(ex.expected)}
                      </li>
                    ))}
                  </ul>
                </details>
              </PixelPanel>
            )}
            <Logs lines={view.logs ?? []} />
            {view.role === "copilote" && (
              <div className="px-actions">
                <PixelButton variant="primary" onClick={() => hand("hand:request")} disabled={view.hand === "envoyee"}>
                  {view.hand === "envoyee" ? "Demande envoyée…" : "Demander la main"}
                </PixelButton>
                {view.canTakeOver && (
                  <PixelButton onClick={() => hand("hand:take")}>Prendre la main (pilote absent)</PixelButton>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {view.partner && !view.partner.online && (
        <p className="px-muted">
          {view.partner.name} n&apos;est pas connecté. {view.role === "pilote" ? "Vous continuez ; il retrouvera l'état à son retour. " : ""}
          Si cela dure, prévenez le recruteur : il peut vous faire poursuivre seul.
        </p>
      )}
    </div>
  );
}

function Logs({ lines }: { lines: string[] }) {
  const box = useRef<HTMLPreElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines.length]);
  return (
    <PixelPanel tone="amber" title="Logs d'exécution">
      <pre ref={box} tabIndex={0} aria-label="Logs d'exécution" className="px-logs" style={{ margin: 0 }}>
        {lines.join("\n")}
      </pre>
    </PixelPanel>
  );
}
