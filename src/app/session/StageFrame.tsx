"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { STAGE_KIND } from "@/engine/stages";
import { Hud, PixelLink, PixelPanel, type GemId, type Tone } from "@/ui/pixel/components";
import { Drawer } from "@/ui/pixel/Drawer";
import { DraftScope } from "./code-stage";
import { Countdown } from "./Countdown";
import { EventTracker } from "./EventTracker";

const GEM_ORDER: GemId[] = ["quiz", "sql", "algo", "logique"];

/** Message uniforme à chaque gemme obtenue : laquelle, ce qui reste, et la suite. */
function GemObtained({ title, have, binome }: { title: string; have: GemId[]; binome: boolean }) {
  const missing = GEM_ORDER.filter((g) => !have.includes(g));
  return (
    <div role="status">
      <p className="px-read" style={{ margin: 0, fontWeight: 700 }}>
        {title} : gemme obtenue !
      </p>
      <p className="px-read" style={{ margin: "0.5rem 0 0" }}>
        {missing.length > 0
          ? `Il vous reste ${missing.length} gemme${missing.length > 1 ? "s" : ""} : ${missing.map((g) => STAGE_KIND[g].subtitle).join(", ")}.`
          : binome
            ? "Vos 4 gemmes sont réunies. Retournez au quartier : le Portail s'ouvre dès que votre binôme a les siennes."
            : "Vos 4 gemmes sont réunies. Retournez au quartier : le Portail s'ouvre."}
      </p>
    </div>
  );
}

const TONE: Record<GemId, Tone> = { quiz: "cyan", sql: "green", algo: "magenta", logique: "amber" };

/**
 * Cadre commun des épreuves (côté candidat) : HUD réduit (chrono, gemmes,
 * tiroir d'aide), titre, énoncé, puis UNE zone d'action (`children`).
 * Le tiroir n'existe que si `help` est fourni ; Bip et les indices viendront
 * s'y ajouter plus tard (étape 12), sans changer l'écran.
 */
export function StageFrame({
  gem,
  title,
  story,
  gems,
  deadlineIso,
  serverNowIso,
  done,
  binome = false,
  help,
  wide = false,
  children,
}: {
  gem: GemId;
  title: string;
  story: string;
  gems: GemId[];
  deadlineIso: string | null;
  serverNowIso: string;
  done: boolean;
  /** Binôme : à 4 gemmes, il reste à attendre l'autre candidat. */
  binome?: boolean;
  help?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const tone = TONE[gem];

  return (
    <DraftScope.Provider value={deadlineIso ?? ""}>
      <div className={`px-stage ${wide ? "px-stage-wide" : ""}`}>
        <EventTracker stage={gem} />
        <Hud
          timer={deadlineIso ? <Countdown pixel deadlineIso={deadlineIso} serverNowIso={serverNowIso} /> : "--:--"}
          gems={gems}
          drawer={help ? { label: "Règles et aide", onClick: () => setOpen((o) => !o), expanded: open } : undefined}
        />
        <div className="px-stage-head">
          <Link href="/session" className="px-link">
            ← Quartier
          </Link>
          <h1 className="px-stage-title">{title}</h1>
        </div>
        <PixelPanel tone={tone}>
          <p className="px-read px-story">{story}</p>
        </PixelPanel>
        {done ? (
          <PixelPanel tone="green" glow={1}>
            <GemObtained title={title} have={gems} binome={binome} />
            <div className="px-actions">
              <PixelLink href="/session" variant="primary">
                Retour au quartier
              </PixelLink>
            </div>
          </PixelPanel>
        ) : (
          children
        )}
        {help && (
          <Drawer open={open} onClose={close} title="Aide">
            {help}
          </Drawer>
        )}
      </div>
    </DraftScope.Provider>
  );
}
