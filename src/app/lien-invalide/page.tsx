import { Suspense } from "react";

const MESSAGES: Record<string, string> = {
  invalide: "Ce lien n'est pas valide. Vérifiez que vous avez copié le lien complet, ou demandez-en un nouveau au recruteur.",
  "pas-encore": "Votre session n'est pas encore ouverte. Le lien fonctionne à partir de 15 minutes avant l'heure prévue.",
  expire: "Ce lien a expiré. Contactez le recruteur pour convenir d'un nouveau créneau.",
  termine: "Cette session est terminée. Merci pour votre participation !",
};

async function Message({ searchParams }: { searchParams: Promise<{ raison?: string }> }) {
  const { raison } = await searchParams;
  return <p className="text-zinc-700 dark:text-zinc-300">{MESSAGES[raison ?? ""] ?? MESSAGES.invalide}</p>;
}

export default function LienInvalidePage({ searchParams }: PageProps<"/lien-invalide">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Le Portail reste fermé</h1>
      <Suspense>
        <Message searchParams={searchParams as Promise<{ raison?: string }>} />
      </Suspense>
    </main>
  );
}
