import type { ReactNode } from "react";
import { RULES, STAGE_KIND } from "@/engine/stages";
import { GEM_IDS, type GemId } from "@/engine/timeline";
import { GemIcon, PixelPanel } from "@/ui/pixel/components";
import { WorldPreview } from "@/ui/pixel/world/WorldPreview";
import { LocalTime } from "./LocalTime";

/** Accueil d'avant départ : présentation, règles, avis d'enregistrement, puis `action` (le bouton Commencer). */
export function WelcomeScreen({
  company,
  title,
  pitch,
  mode,
  action,
  startedClock,
  callUrl,
}: {
  company: string;
  title: string;
  pitch: string;
  mode: "solo" | "binome";
  action: ReactNode;
  /** Second du binôme : le chrono commun tourne déjà (heure de départ du binôme et minutes restantes). */
  startedClock?: { startedAtIso: string; remainingMin: number };
  /** Lien de l'appel du binôme (saisi par le recruteur). */
  callUrl?: string | null;
}) {
  return (
    <main className="px-center">
      <p className="px-eyebrow">{company}</p>
      <h1 className="px-hero-title">{title}</h1>
      <WorldPreview done={[]} label="Le quartier du Portail, de nuit : quatre bâtiments et le Portail fermé au centre" />
      <PixelPanel tone="cyan">
        <p className="px-read px-story">{pitch}</p>
      </PixelPanel>
      <PixelPanel tone="violet" title="Comment ça marche">
        <ul className="px-rules">
          {startedClock ? (
            <li>
              <strong>Le chrono de votre binôme tourne déjà</strong> : il a commencé à <LocalTime iso={startedClock.startedAtIso} />. Le temps est
              commun, il vous reste <strong>{startedClock.remainingMin} min</strong> (sur 45).
            </li>
          ) : (
            <li>
              Vous avez 45 minutes. Le chrono démarre quand vous cliquez sur « Commencer »
              {mode === "binome" ? " (le premier du binôme à cliquer lance le chrono commun)." : "."}
            </li>
          )}
          <li>Collectez les 4 gemmes, dans l&apos;ordre de votre choix :</li>
          <li className="px-rules-sub">
            <ul>
              {GEM_IDS.map((g) => (
                <li key={g}>
                  <strong>{STAGE_KIND[g].subtitle}</strong> — {STAGE_KIND[g].detail}
                </li>
              ))}
            </ul>
          </li>
          {mode === "binome" ? (
            <li>Le Portail s&apos;ouvre quand vous et votre binôme avez vos gemmes (au plus tard à la 33ᵉ minute) : vous le franchirez ensemble.</li>
          ) : (
            <li>Le Portail s&apos;ouvre quand vous avez vos 4 gemmes (au plus tard à la 33ᵉ minute).</li>
          )}
          <li>Aucune note n&apos;est affichée : c&apos;est votre démarche qui compte.</li>
        </ul>
      </PixelPanel>
      <PixelPanel tone="green" title="Ce qui est permis">
        <ul className="px-rules">
          <li>
            <strong>Autorisé :</strong> {RULES.allowed.join(" ; ")}.
          </li>
          <li>
            <strong>Interdit :</strong> {RULES.forbidden.join(" ; ")}.
          </li>
          <li>{RULES.tabs}</li>
        </ul>
      </PixelPanel>
      {mode === "binome" && (
        <PixelPanel tone="cyan" title="Parler à votre binôme">
          {callUrl ? (
            <p className="px-read" style={{ margin: 0 }}>
              Au Portail, vous aurez besoin de vous parler : l&apos;un voit le code, l&apos;autre les logs.{" "}
              <a href={callUrl} target="_blank" rel="noopener noreferrer" className="px-link">
                Rejoindre l&apos;appel (nouvel onglet)
              </a>
              . Un petit chat de secours existe aussi dans le Portail.
            </p>
          ) : (
            <p className="px-read" style={{ margin: 0 }}>
              Au Portail, vous aurez besoin de vous parler : l&apos;un voit le code, l&apos;autre les logs. Le recruteur vous indique comment
              rejoindre l&apos;appel ; un petit chat de secours existe aussi dans le Portail.
            </p>
          )}
        </PixelPanel>
      )}
      <PixelPanel tone="amber" title="Enregistrement de la session">
        <p className="px-read" style={{ margin: 0, fontSize: "1rem" }}>
          Vos actions dans cette application (réponses, code, exécutions, changements d&apos;onglet, messages du chat) sont enregistrées pour
          permettre au recruteur de revoir la session. Ces données sont conservées <strong>6 mois</strong> puis supprimées. En cliquant sur
          « Commencer », vous confirmez en avoir pris connaissance.
        </p>
      </PixelPanel>
      {action}
    </main>
  );
}

/** Rapport de fin côté candidat : gemmes, durée, épilogue si le Portail est franchi. Jamais de note. */
export function ReportScreen({
  company,
  retired,
  gems,
  stageTitles,
  portalSolved,
  epilogue,
  minutes,
  followUpDays = 7,
}: {
  company: string;
  retired: boolean;
  gems: readonly GemId[];
  stageTitles: Record<GemId, string>;
  portalSolved: boolean;
  epilogue: string;
  minutes: number | null;
  /** Délai annoncé pour le retour du recruteur (CANDIDATE_FOLLOWUP_DAYS). */
  followUpDays?: number;
}) {
  return (
    <main className="px-center">
      <p className="px-eyebrow">{company}</p>
      <h1 className="px-hero-title">{retired ? "Session clôturée" : "Rapport de mission"}</h1>
      {retired ? (
        <PixelPanel tone="violet">
          <p className="px-read px-story">Le recruteur a poursuivi l&apos;épreuve sans vous. Merci pour votre participation !</p>
        </PixelPanel>
      ) : (
        <>
          <WorldPreview
            done={GEM_IDS.filter((g) => gems.includes(g))}
            portalOpen={portalSolved}
            label={portalSolved ? "Le quartier du Portail : le Portail est ouvert" : "Le quartier du Portail : le Portail reste fermé"}
          />
          {!portalSolved && (
            <PixelPanel tone="violet" title="Le Portail">
              <p className="px-read" style={{ margin: 0 }}>
                Le Portail n&apos;a pas été franchi dans le temps imparti. Cela arrive : le recruteur regarde surtout votre démarche, pas seulement le
                résultat.
              </p>
            </PixelPanel>
          )}
          {portalSolved && (
            <PixelPanel tone="green" glow={2} title="Le Portail s'ouvre">
              <p className="px-read px-story">{epilogue}</p>
            </PixelPanel>
          )}
          <PixelPanel tone="cyan" title="Vos gemmes">
            <ul className="px-gemrow">
              {GEM_IDS.map((gem) => {
                const done = gems.includes(gem);
                return (
                  <li key={gem}>
                    <GemIcon gem={gem} lit={done} />
                    <span>
                      {stageTitles[gem]}
                      <small>{done ? "Gemme obtenue" : "Non validée dans le temps imparti"}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
            {minutes !== null && (
              <p className="px-muted" style={{ marginBottom: 0 }}>
                Durée de la session : {minutes} min sur 45.
              </p>
            )}
          </PixelPanel>
          <p className="px-read" style={{ textAlign: "center", margin: 0 }}>
            Merci pour votre participation ! Le recruteur reviendra vers vous sous {followUpDays} jours.
          </p>
        </>
      )}
    </main>
  );
}
