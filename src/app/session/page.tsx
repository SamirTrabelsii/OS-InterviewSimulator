import { Suspense } from "react";
import { GEM_IDS, type GemId } from "@/engine/timeline";
import { currentCandidate } from "@/server/candidate/current";
import { loadPublicInstance } from "@/server/content/registry";
import { Hud, PixelPanel } from "@/ui/pixel/components";
import { HubWorld } from "@/ui/pixel/world/HubWorld";
import { AutoRefresh } from "./AutoRefresh";
import { Countdown } from "./Countdown";
import { EventTracker } from "./EventTracker";
import { ReportScreen, WelcomeScreen } from "./Screens";
import { StartButton } from "./StartButton";

async function SessionScreen() {
  const candidate = await currentCandidate();
  if (!candidate) {
    return (
      <main className="px-center">
        <PixelPanel tone="cyan" glow={1} title="Le Portail">
          <p className="px-read px-story">Ouvrez le lien personnel que vous avez reçu pour accéder à votre session.</p>
        </PixelPanel>
      </main>
    );
  }
  const { view, now } = candidate;
  const content = loadPublicInstance(view.scenarioId, view.seed);

  if (view.phase === "attente") {
    return (
      <>
        <EventTracker stage="accueil" />
        <WelcomeScreen
          company={content.meta.company}
          title={content.meta.title}
          pitch={content.meta.pitch}
          mode={view.mode}
          action={<StartButton disabled={!view.canStartNow} availableAt={view.scheduledAt.toISOString()} />}
        />
      </>
    );
  }

  if (view.phase === "termine") {
    const minutes =
      view.t0 && view.deadline ? Math.round((Math.min(view.deadline.getTime(), now.getTime()) - view.t0.getTime()) / 60_000) : null;
    return (
      <>
        <EventTracker stage="fin" />
        <ReportScreen
          company={content.meta.company}
          retired={view.retired}
          gems={view.gems as GemId[]}
          stageTitles={{
            quiz: content.stages.quiz.title,
            sql: content.stages.sql.title,
            algo: content.stages.algo.title,
            logique: content.stages.logique.title,
          }}
          portalSolved={view.portalSolved}
          epilogue={content.meta.epilogue}
          minutes={minutes}
        />
      </>
    );
  }

  const portalOpen = view.phase === "portail";

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-3">
      <h1 className="px-sr">{content.meta.title} : choisissez une épreuve</h1>
      <EventTracker stage="hub" />
      <Hud
        timer={
          view.deadline ? (
            <Countdown pixel deadlineIso={view.deadline.toISOString()} serverNowIso={now.toISOString()} />
          ) : (
            "--:--"
          )
        }
        gems={GEM_IDS.filter((g) => view.gems.includes(g))}
      />
      <HubWorld
        stages={GEM_IDS.map((gem) => ({ gem, title: content.stages[gem].title, done: view.gems.includes(gem) }))}
        portal={{ title: content.stages.portail.title, open: portalOpen }}
      />
      {!portalOpen && <AutoRefresh everyMs={10_000} />}
    </main>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <main className="px-center">
          <p className="px-muted" role="status">
            Chargement…
          </p>
        </main>
      }
    >
      <SessionScreen />
    </Suspense>
  );
}
