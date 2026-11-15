"use client";

import { PixelButton, PixelPanel } from "@/ui/pixel/components";
import { NightShell } from "@/ui/pixel/NightShell";
import { Backdrop } from "@/ui/pixel/world/Backdrop";

/** Dernier filet : l'erreur a touché la mise en page racine, on la redessine entièrement. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <NightShell className="px-fill">
          <Backdrop id="quartier" />
          <main className="px-center">
            <PixelPanel tone="amber" glow={1} title="! Un incident est survenu">
              <p className="px-read px-story">L&apos;application a rencontré un problème. Réessayez dans un instant.</p>
              <div className="px-actions">
                <PixelButton variant="primary" onClick={reset}>
                  Réessayer
                </PixelButton>
              </div>
            </PixelPanel>
          </main>
        </NightShell>
      </body>
    </html>
  );
}
