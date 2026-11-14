"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PortalView } from "@/engine/portal";
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
    <span role="timer" className={`font-mono text-2xl tabular-nums ${total < 300 ? "text-red-600 dark:text-red-400" : ""}`}>
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
    <p role="alert" className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      {text[link]}
    </p>
  );
}

function PartnerBadge({ view }: { view: PortalView }) {
  if (!view.partner) return null;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${view.partner.online ? "bg-green-500" : "bg-zinc-400"}`} />
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
        <p className="text-zinc-500">Connexion au Portail…</p>
      </>
    );
  }

  return (
    <section className="space-y-4">
      <EventTracker stage="portail" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/session" className="text-sm underline">
            ← Retour aux gemmes
          </Link>
          <h1 className="text-2xl font-semibold">{view.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <PartnerBadge view={view} />
          <Clock view={view} offset={offset.current} />
        </div>
      </header>
      <LinkBanner link={link} />

      {view.phase === "ferme" && <Closed view={view} />}
      {view.phase === "termine" && <p className="text-center text-lg">Temps écoulé. Merci pour votre participation !</p>}
      {view.phase === "resolu" && (
        <div className="space-y-3 rounded-xl border border-green-500 bg-green-50 p-6 text-green-900 dark:bg-green-950 dark:text-green-100">
          <p className="text-xl font-semibold">Le Portail s&apos;ouvre !</p>
          <p>{epilogue}</p>
          <p className="text-sm">Le recruteur reviendra vers vous. Vous pouvez fermer cet onglet.</p>
        </div>
      )}
      {view.phase === "ouvert" && <Open view={view} send={send} link={link} />}
    </section>
  );
}

function Closed({ view }: { view: PortalView }) {
  const latest = view.opensByLatest ? new Date(view.opensByLatest) : null;
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-indigo-400 p-8 text-center">
      <p className="text-xl font-medium">Le Portail s&apos;éveille…</p>
      <p className="text-zinc-600 dark:text-zinc-400">
        Il s&apos;ouvrira dès que {view.partner ? "vous et votre binôme aurez" : "vous aurez"} les 4 gemmes
        {latest ? `, au plus tard à ${latest.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}.
      </p>
      <p>
        <Link href="/session" className="underline">
          Retourner chercher les gemmes manquantes
        </Link>
      </p>
    </div>
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
    <div className="space-y-3">
      <h2 className="font-medium">Le code à corriger{view.functionName ? ` — ${view.functionName}` : ""}</h2>
      <CodeEditor language="python" initialValue={view.code ?? ""} onChange={onChange} onRun={run} label="Code Python du Portail" height={420} />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={busy} className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
          {busy ? "Vérification…" : "Exécuter et vérifier"}
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">Ctrl + Entrée · seul le pilote tape.</span>
      </div>
      {view.role === "pilote" && (
        <p className="rounded-md border border-dashed border-zinc-400 p-3 text-sm text-zinc-600 dark:text-zinc-400">
          Vous ne voyez ni les logs ni le ticket du client : votre copilote les a. Parlez-vous (Teams) !
        </p>
      )}
    </div>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{ROLE_LABEL[view.role]}</p>
        {view.result && (
          <p aria-live="polite" className="font-mono text-lg">
            {view.result.passed} / {view.result.total}
          </p>
        )}
      </div>
      <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">{view.story}</p>
      {note && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {note}
        </p>
      )}

      {view.hand === "recue" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-400 p-4">
          <p>Votre binôme demande le clavier.</p>
          <div className="flex gap-2">
            <button onClick={() => hand("hand:grant")} className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
              Passer la main
            </button>
            <button onClick={() => hand("hand:deny")} className="rounded-md border border-zinc-400 px-3 py-1.5">
              Pas maintenant
            </button>
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${writer && seesContext ? "lg:grid-cols-2" : ""}`}>
        {writer && <PilotEditor key={`${view.epoch}-${view.role}`} view={view} send={send} link={link} onNote={setNote} />}

        {seesContext && (
          <div className="space-y-3">
            {view.clientContext && (
              <div className="rounded-lg border-l-4 border-sky-500 bg-sky-50 px-4 py-3 dark:bg-sky-950">
                <h2 className="mb-1 font-medium">Contexte client</h2>
                <p>{view.clientContext}</p>
              </div>
            )}
            {view.statement && <p className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 dark:bg-emerald-950">{view.statement}</p>}
            {view.examples && (
              <details className="rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
                <summary className="cursor-pointer font-medium">Exemples</summary>
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  {view.examples.map((ex, i) => (
                    <li key={i}>
                      ({ex.args.map(show).join(", ")}) → {show(ex.expected)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Logs lines={view.logs ?? []} />
            {view.role === "copilote" && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => hand("hand:request")}
                  disabled={view.hand === "envoyee"}
                  className="rounded-md border border-indigo-500 px-4 py-2 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
                >
                  {view.hand === "envoyee" ? "Demande envoyée…" : "Demander la main"}
                </button>
                {view.canTakeOver && (
                  <button onClick={() => hand("hand:take")} className="rounded-md bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-400">
                    Prendre la main (pilote absent)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {view.partner && !view.partner.online && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
    <div>
      <h2 className="mb-1 font-medium">Logs d&apos;exécution</h2>
      <pre ref={box} tabIndex={0} aria-label="Logs d'exécution" className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100">
        {lines.join("\n")}
      </pre>
    </div>
  );
}
