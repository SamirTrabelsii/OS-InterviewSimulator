import { Suspense } from "react";
import { PixelPanel } from "@/ui/pixel/components";
import { NightShell } from "@/ui/pixel/NightShell";

const MESSAGES: Record<string, string> = {
  invalide: "Ce lien n'est pas valide. Vérifiez que vous avez copié le lien complet, ou demandez-en un nouveau au recruteur.",
  "pas-encore": "Votre session n'est pas encore ouverte. Le lien fonctionne à partir de 15 minutes avant l'heure prévue.",
  expire: "Ce lien a expiré. Contactez le recruteur pour convenir d'un nouveau créneau.",
  termine: "Cette session est terminée. Merci pour votre participation !",
};

async function Message({ searchParams }: { searchParams: Promise<{ raison?: string }> }) {
  const { raison } = await searchParams;
  return <p className="px-read px-story">{MESSAGES[raison ?? ""] ?? MESSAGES.invalide}</p>;
}

export default function LienInvalidePage({ searchParams }: PageProps<"/lien-invalide">) {
  return (
    <NightShell className="px-fill">
      <main className="px-center">
        <PixelPanel tone="violet" glow={1} title="Le Portail reste fermé">
          <Suspense>
            <Message searchParams={searchParams as Promise<{ raison?: string }>} />
          </Suspense>
        </PixelPanel>
      </main>
    </NightShell>
  );
}
