import { Suspense } from "react";
import { STAGE_KIND } from "@/engine/stages";
import { deadlineFrom, GEM_IDS, PORTAL_LATEST_MS, remainingMs, type GemId } from "@/engine/timeline";
import { currentCandidate } from "@/server/candidate/current";
import { followUpDays } from "@/server/candidate/followup";
import { loadPublicInstance } from "@/server/content/registry";
import { Hud, PixelPanel } from "@/ui/pixel/components";
import { HubWorld } from "@/ui/pixel/world/HubWorld";
import { AutoRefresh } from "./AutoRefresh";
import { Countdown } from "./Countdown";
import { EventTracker } from "./EventTracker";
import { LocalTime } from "./LocalTime";
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
          callUrl={view.callUrl}
          startedClock={
            view.mode === "binome" && view.slotT0 && now < deadlineFrom(view.slotT0)
              ? { startedAtIso: view.slotT0.toISOString(), remainingMin: Math.max(1, Math.floor(remainingMs(view.slotT0, now) / 60_000)) }
              : undefined
          }
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
          followUpDays={followUpDays()}
        />
      </>
    );
  }

  const portalOpen = view.phase === "portail";
  const allGems = GEM_IDS.every((g) => view.gems.includes(g));
  const waitingForPartner = !portalOpen && allGems && view.partner !== null;
  const latestIso = view.t0 ? new Date(view.t0.getTime() + PORTAL_LATEST_MS).toISOString() : null;

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
        stages={GEM_IDS.map((gem) => ({ gem, title: content.stages[gem].title, done: view.gems.includes(gem), subtitle: STAGE_KIND[gem].subtitle }))}
        portal={{
          title: content.stages.portail.title,
          open: portalOpen,
          hint: waitingForPartner && view.partner
            ? `pas encore ouvert, en attente de ${view.partner.name} (${view.partner.gems} sur 4 gemmes)`
            : "pas encore ouvert : il s'ouvre quand toutes les gemmes sont réunies",
        }}
        idleHint={
          waitingForPartner && view.partner
            ? `Vos 4 gemmes sont réunies. Le Portail s'ouvre dès que ${view.partner.name} aura les siennes.`
            : undefined
        }
      />
      {!portalOpen && (
        <HubStatus
          partner={view.partner}
          allGems={allGems}
          latestIso={latestIso}
          callUrl={view.callUrl}
        />
      )}
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

/** État du Portail et du binôme sous le quartier : jamais « rien ne se passe ». */
function HubStatus({
  partner,
  allGems,
  latestIso,
  callUrl,
}: {
  partner: { name: string; gems: number; online: boolean; started: boolean } | null;
  allGems: boolean;
  latestIso: string | null;
  callUrl: string | null;
}) {
  const latest = latestIso ? (
    <>
      , au plus tard à <LocalTime iso={latestIso} />
    </>
  ) : null;
  const call = callUrl ? (
    <>
      {" "}
      <a href={callUrl} target="_blank" rel="noopener noreferrer" className="px-link">
        Rejoindre l&apos;appel
      </a>
    </>
  ) : null;

  if (partner && allGems) {
    return (
      <PixelPanel tone="violet" glow={1} title="Vos 4 gemmes sont réunies">
        <p className="px-read" role="status" style={{ margin: 0 }}>
          Le Portail s&apos;ouvre dès que <strong>{partner.name}</strong> a les siennes{latest}. Vous n&apos;avez rien d&apos;autre à faire : cette
          page se met à jour toute seule.
        </p>
        <p className="px-muted" style={{ margin: "0.5rem 0 0" }}>
          {partner.name} : {partner.started ? `${partner.gems} sur 4 gemmes · ${partner.online ? "connecté" : "hors ligne"}` : "n'a pas encore commencé"}.
          {call}
        </p>
      </PixelPanel>
    );
  }
  return (
    <p className="px-muted px-hub-status" role="status">
      {partner ? (
        <>
          Binôme : <strong>{partner.name}</strong> ·{" "}
          {partner.started ? `${partner.gems} sur 4 gemmes · ${partner.online ? "connecté" : "hors ligne"}` : "n'a pas encore commencé"}. Le Portail s&apos;ouvre
          quand vous avez tous les deux vos gemmes{latest}.{call}
        </>
      ) : (
        <>Le Portail s&apos;ouvre quand vous avez vos 4 gemmes{latest}.</>
      )}
    </p>
  );
}
