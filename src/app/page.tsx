import { PixelPanel } from "@/ui/pixel/components";
import { Backdrop } from "@/ui/pixel/world/Backdrop";
import { NightShell } from "@/ui/pixel/NightShell";

export default function Accueil() {
  return (
    <NightShell className="px-fill">
      <Backdrop id="quartier" />
      <main className="px-center">
        <PixelPanel tone="cyan" glow={1} title="Le Portail">
          <p className="px-read px-story">Pour commencer votre session, ouvrez le lien personnel que vous avez reçu.</p>
        </PixelPanel>
      </main>
    </NightShell>
  );
}
