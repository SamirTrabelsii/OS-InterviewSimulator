import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentCandidate } from "@/server/candidate/current";
import { loadPublicInstance } from "@/server/content/registry";
import { StageLoading } from "../StageLoading";
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
    <Suspense fallback={<StageLoading />}>
      <div className="px-stage px-stage-wide">
        <PortailScreen />
      </div>
    </Suspense>
  );
}
