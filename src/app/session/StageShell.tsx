import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { GemId } from "@/engine/timeline";
import { currentCandidate } from "@/server/candidate/current";
import { loadPublicInstance } from "@/server/content/registry";
import type { PublicInstance } from "@/engine/content/schemas";
import { Countdown } from "./Countdown";
import { EventTracker } from "./EventTracker";

/**
 * Cadre commun d'une épreuve : vérifie la session, n'utilise que le
 * contenu PUBLIC, affiche le chrono et un retour au hub.
 */
export async function StageShell({
  gem,
  children,
}: {
  gem: GemId;
  children: (ctx: { content: PublicInstance; done: boolean }) => ReactNode;
}) {
  const candidate = await currentCandidate();
  if (!candidate) redirect("/session");
  const { view, now } = candidate;
  if (view.phase === "attente" || view.phase === "termine") redirect("/session");

  const content = loadPublicInstance(view.scenarioId, view.seed);
  const done = view.gems.includes(gem);
  return (
    <section className="space-y-6">
      <EventTracker stage={gem} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/session" className="text-sm underline">
          ← Retour aux gemmes
        </Link>
        {view.deadline && <Countdown deadlineIso={view.deadline.toISOString()} serverNowIso={now.toISOString()} />}
      </header>
      <h1 className="text-2xl font-semibold">{content.stages[gem].title}</h1>
      <p className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">{content.stages[gem].story}</p>
      {done ? (
        <p className="rounded-md bg-green-50 px-4 py-3 text-green-800 dark:bg-green-950 dark:text-green-200">
          Gemme obtenue.{" "}
          <Link href="/session" className="underline">
            Retour aux gemmes
          </Link>
        </p>
      ) : (
        children({ content, done })
      )}
    </section>
  );
}
