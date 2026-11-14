import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentCandidate } from "@/server/candidate/current";
import { loadPublicInstance } from "@/server/content/registry";
import { PortalClient } from "./PortalClient";

async function PortailScreen() {
  const candidate = await currentCandidate();
  if (!candidate) redirect("/session");
  const { view } = candidate;
  if (view.phase === "attente" || view.phase === "termine") redirect("/session");
  const content = loadPublicInstance(view.scenarioId, view.seed);
  // Contenu PUBLIC et commun aux deux rôles ; le code, les logs et le ticket
  // n'arrivent que par la socket, filtrés selon le rôle.
  return <PortalClient epilogue={content.meta.epilogue} />;
}

export default function PortailPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <PortailScreen />
      </Suspense>
    </main>
  );
}
