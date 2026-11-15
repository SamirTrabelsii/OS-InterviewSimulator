import type { Metadata } from "next";
import { PixelLink, PixelPanel } from "@/ui/pixel/components";
import { NightShell } from "@/ui/pixel/NightShell";
import { Backdrop } from "@/ui/pixel/world/Backdrop";

export const metadata: Metadata = { title: "Page introuvable · Le Portail", robots: { index: false } };

/** Page introuvable : même quartier de nuit que le reste. */
export default function NotFound() {
  return (
    <NightShell className="px-fill">
      <Backdrop id="quartier" />
      <main className="px-center">
        <PixelPanel tone="violet" glow={1} title="? Page introuvable">
          <p className="px-read px-story">Cette adresse ne mène nulle part dans le quartier. Pour commencer votre session, ouvrez le lien personnel que vous avez reçu.</p>
          <div className="px-actions">
            <PixelLink href="/" variant="ghost">
              Retour à l&apos;accueil
            </PixelLink>
          </div>
        </PixelPanel>
      </main>
    </NightShell>
  );
}
