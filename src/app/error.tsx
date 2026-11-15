"use client";

import { PixelButton, PixelLink, PixelPanel } from "@/ui/pixel/components";
import { NightShell } from "@/ui/pixel/NightShell";
import { Backdrop } from "@/ui/pixel/world/Backdrop";

/** Incident inattendu hors du parcours candidat : même ambiance, un message calme et une action. */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <NightShell className="px-fill">
      <Backdrop id="quartier" />
      <main className="px-center">
        <PixelPanel tone="amber" glow={1} title="! Un incident est survenu">
          <p className="px-read px-story">Quelque chose s&apos;est mal passé de notre côté. Réessayez dans un instant.</p>
          <div className="px-actions">
            <PixelButton variant="primary" onClick={reset}>
              Réessayer
            </PixelButton>
            <PixelLink href="/" variant="ghost">
              Retour à l&apos;accueil
            </PixelLink>
          </div>
        </PixelPanel>
      </main>
    </NightShell>
  );
}
