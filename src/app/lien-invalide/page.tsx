import { Suspense } from "react";
import { PixelPanel } from "@/ui/pixel/components";
import { Backdrop } from "@/ui/pixel/world/Backdrop";
import { NightShell } from "@/ui/pixel/NightShell";
import { LocalDateTime } from "../session/LocalTime";

const MESSAGES: Record<string, string> = {
  invalide: "Ce lien n'est pas valide. Vérifiez que vous avez copié le lien complet, ou demandez-en un nouveau au recruteur.",
  "pas-encore": "Votre session n'est pas encore ouverte. Le lien fonctionne à partir de 15 minutes avant l'heure prévue.",
  expire: "Ce lien a expiré. Contactez le recruteur pour convenir d'un nouveau créneau.",
  termine: "Cette session est terminée. Merci pour votre participation !",
};

async function Message({ searchParams }: { searchParams: Promise<{ raison?: string; quand?: string }> }) {
  const { raison, quand } = await searchParams;
  const date = quand && !Number.isNaN(Date.parse(quand)) ? new Date(quand) : null;
  return (
    <>
      <p className="px-read px-story">{MESSAGES[raison ?? ""] ?? MESSAGES.invalide}</p>
      {date && (raison === "pas-encore" || raison === "expire") && (
        <p className="px-read">
          Heure prévue de votre créneau : <LocalDateTime iso={date.toISOString()} />.
        </p>
      )}
    </>
  );
}

export default function LienInvalidePage({ searchParams }: PageProps<"/lien-invalide">) {
  return (
    <NightShell className="px-fill">
      <Backdrop id="quartier" />
      <main className="px-center">
        <PixelPanel tone="violet" glow={1} title="Le Portail reste fermé">
          <Suspense>
            <Message searchParams={searchParams as Promise<{ raison?: string; quand?: string }>} />
          </Suspense>
        </PixelPanel>
      </main>
    </NightShell>
  );
}
