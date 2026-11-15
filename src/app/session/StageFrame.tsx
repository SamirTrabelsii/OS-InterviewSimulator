"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { Hud, PixelLink, PixelPanel, type GemId, type Tone } from "@/ui/pixel/components";
import { Drawer } from "@/ui/pixel/Drawer";
import { NightShell } from "@/ui/pixel/NightShell";
import { Countdown } from "./Countdown";
import { EventTracker } from "./EventTracker";

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
  help?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const tone = TONE[gem];

  return (
    <NightShell>
      <div className={`px-stage ${wide ? "px-stage-wide" : ""}`}>
        <EventTracker stage={gem} />
        <Hud
          timer={deadlineIso ? <Countdown pixel deadlineIso={deadlineIso} serverNowIso={serverNowIso} /> : "--:--"}
          gems={gems}
          drawer={help ? { label: "Aide", onClick: () => setOpen((o) => !o), expanded: open } : undefined}
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
            <p className="px-read" style={{ margin: 0 }}>
              Gemme obtenue.
            </p>
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
    </NightShell>
  );
}
