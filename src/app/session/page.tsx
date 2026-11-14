import Link from "next/link";
import { Suspense } from "react";
import { GEM_IDS } from "@/engine/timeline";
import { currentCandidate } from "@/server/candidate/current";
import { loadPublicInstance } from "@/server/content/registry";
import { AutoRefresh } from "./AutoRefresh";
import { Countdown } from "./Countdown";
import { EventTracker } from "./EventTracker";
import { StartButton } from "./StartButton";

const GEM_STYLE: Record<string, string> = {
  quiz: "from-amber-400 to-orange-500",
  sql: "from-sky-400 to-blue-600",
  algo: "from-emerald-400 to-green-600",
  logique: "from-fuchsia-400 to-purple-600",
};

async function SessionScreen() {
  const candidate = await currentCandidate();
  if (!candidate) {
    return (
      <section className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Le Portail</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Ouvrez le lien personnel que vous avez reçu pour accéder à votre session.</p>
      </section>
    );
  }
  const { view, now } = candidate;
  const content = loadPublicInstance(view.scenarioId, view.seed);

  if (view.phase === "attente") {
    return (
      <section className="space-y-6">
        <EventTracker stage="accueil" />
        <p className="text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{content.meta.company}</p>
        <h1 className="text-3xl font-semibold">{content.meta.title}</h1>
        <p className="text-lg leading-relaxed">{content.meta.pitch}</p>
        <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
          <li>Vous avez 45 minutes. Le chrono démarre quand vous cliquez sur « Commencer ».</li>
          <li>Collectez les 4 gemmes, dans l&apos;ordre de votre choix.</li>
          {view.mode === "binome" ? (
            <li>Le Portail s&apos;ouvre quand vous et votre binôme avez vos gemmes (au plus tard à la 33ᵉ minute) : vous le franchirez ensemble.</li>
          ) : (
            <li>Le Portail s&apos;ouvre quand vous avez vos 4 gemmes (au plus tard à la 33ᵉ minute).</li>
          )}
          <li>Aucune note n&apos;est affichée : c&apos;est votre démarche qui compte.</li>
        </ul>
        <aside className="rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <strong>Enregistrement de la session.</strong> Vos actions dans cette application (réponses, code, exécutions, changements
          d&apos;onglet) sont enregistrées pour permettre au recruteur de revoir la session. Ces données sont conservées{" "}
          <strong>6 mois</strong> puis supprimées. En cliquant sur « Commencer », vous confirmez en avoir pris connaissance.
        </aside>
        <StartButton disabled={!view.canStartNow} availableAt={view.scheduledAt.toISOString()} />
      </section>
    );
  }

  if (view.phase === "termine") {
    return (
      <section className="space-y-6">
        <EventTracker stage="fin" />
        <header className="space-y-1 text-center">
          <p className="text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{content.meta.company}</p>
          <h1 className="text-2xl font-semibold">{view.retired ? "Session clôturée" : "Rapport de mission"}</h1>
        </header>
        {view.retired ? (
          <p className="text-center text-zinc-700 dark:text-zinc-300">Le recruteur a poursuivi l&apos;épreuve sans vous. Merci pour votre participation !</p>
        ) : (
          <>
            {view.portalSolved && <p className="text-lg leading-relaxed">{content.meta.epilogue}</p>}
            <ul className="grid gap-3 sm:grid-cols-2">
              {GEM_IDS.map((gem) => {
                const done = view.gems.includes(gem);
                return (
                  <li key={gem} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <span aria-hidden className={`h-8 w-8 shrink-0 rotate-45 rounded-md bg-gradient-to-br ${GEM_STYLE[gem]} ${done ? "" : "opacity-25 grayscale"}`} />
                    <span>
                      <span className="block font-medium">{content.stages[gem].title}</span>
                      <span className="block text-sm text-zinc-600 dark:text-zinc-400">{done ? "Gemme obtenue" : "Gemme non obtenue"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            {view.t0 && view.deadline && (
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                Durée de la session : {Math.round((Math.min(view.deadline.getTime(), now.getTime()) - view.t0.getTime()) / 60_000)} min sur 45.
              </p>
            )}
            <p className="text-center text-zinc-700 dark:text-zinc-300">Merci pour votre participation ! Le recruteur reviendra vers vous.</p>
          </>
        )}
      </section>
    );
  }

  const portalOpen = view.phase === "portail";

  return (
    <section className="space-y-6">
      <EventTracker stage="hub" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400">{content.meta.company}</p>
          <h1 className="text-2xl font-semibold">{content.meta.title}</h1>
        </div>
        {view.deadline && <Countdown deadlineIso={view.deadline.toISOString()} serverNowIso={now.toISOString()} />}
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {GEM_IDS.map((gem) => {
          const done = view.gems.includes(gem);
          const playable = !done;
          const card = (
            <div
              className={`flex h-full items-center gap-4 rounded-xl border p-4 ${
                done ? "border-transparent bg-zinc-100 dark:bg-zinc-800" : "border-zinc-200 dark:border-zinc-800"
              } ${playable ? "hover:border-indigo-400" : ""}`}
            >
              <span
                aria-hidden
                className={`h-10 w-10 shrink-0 rotate-45 rounded-md bg-gradient-to-br ${GEM_STYLE[gem]} ${done ? "" : "opacity-25 grayscale"}`}
              />
              <span className="space-y-0.5">
                <span className="block font-medium">{content.stages[gem].title}</span>
                <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                  {done ? "Gemme obtenue" : "Disponible"}
                </span>
              </span>
            </div>
          );
          return <li key={gem}>{playable ? <Link href={`/session/${gem}`}>{card}</Link> : card}</li>;
        })}
      </ul>

      <Link href="/session/portail" className="block rounded-xl border border-dashed border-indigo-400 p-4 text-center hover:border-indigo-600">
        <p className="font-medium">{content.stages.portail.title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {portalOpen
            ? "Le Portail est ouvert : rejoignez votre binôme."
            : `Le Portail s'éveille… Il s'ouvrira dès que ${view.mode === "binome" ? "vous et votre binôme aurez" : "vous aurez"} les 4 gemmes, au plus tard à la 33ᵉ minute.`}
        </p>
      </Link>
      {!portalOpen && <AutoRefresh everyMs={10_000} />}
    </section>
  );
}

export default function SessionPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-6">
      <Suspense fallback={<p className="text-center text-zinc-500">Chargement…</p>}>
        <SessionScreen />
      </Suspense>
    </main>
  );
}
