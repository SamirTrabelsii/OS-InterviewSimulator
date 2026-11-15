"use client";

import { PixelButton, PixelLink, PixelPanel } from "@/ui/pixel/components";

/** Incident inattendu dans le parcours candidat : message calme, une action. */
export default function SessionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="px-center">
      <PixelPanel tone="amber" glow={1} title="Un incident est survenu">
        <p className="px-read px-story">Votre travail déjà validé est enregistré et le chrono continue. Réessayez, ou revenez au quartier.</p>
        <div className="px-actions">
          <PixelButton variant="primary" onClick={reset}>
            Réessayer
          </PixelButton>
          <PixelLink href="/session" variant="ghost">
            Retour au quartier
          </PixelLink>
        </div>
      </PixelPanel>
    </main>
  );
}
