import { redirect } from "next/navigation";
import { Suspense } from "react";
import { currentCandidate } from "@/server/candidate/current";
import { loadSessionPublic } from "@/server/content/subject";
import { db } from "@/server/db/client";
import { Backdrop } from "@/ui/pixel/world/Backdrop";
import { StageLoading } from "../StageLoading";
import { PortalClient } from "./PortalClient";

async function PortailScreen() {
  const candidate = await currentCandidate();
  if (!candidate) redirect("/session");
  const { view } = candidate;
  if (view.phase === "attente" || view.phase === "termine") redirect("/session");
  const content = await loadSessionPublic(db(), view);
  // Contenu PUBLIC et commun aux deux rôles ; le code, les logs et le ticket
  // n'arrivent que par la socket, filtrés selon le rôle.
  return <PortalClient epilogue={content.meta.epilogue} />;
}

export default function PortailPage() {
  return (
    <Suspense fallback={<StageLoading />}>
      <Backdrop id="portail" />
      <div className="px-stage px-stage-wide">
        <PortailScreen />
      </div>
    </Suspense>
  );
}
