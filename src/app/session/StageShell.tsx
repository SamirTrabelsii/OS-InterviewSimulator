import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { GemId } from "@/engine/timeline";
import { GEM_IDS } from "@/engine/timeline";
import { currentCandidate } from "@/server/candidate/current";
import { loadPublicInstance } from "@/server/content/registry";
import type { PublicInstance } from "@/engine/content/schemas";
import { StageFrame } from "./StageFrame";

/**
 * Cadre commun d'une épreuve : vérifie la session, n'utilise que le
 * contenu PUBLIC, et délègue l'affichage à StageFrame (HUD, titre, énoncé,
 * tiroir d'aide). `children` ne reçoit que le contenu public.
 */
export async function StageShell({
  gem,
  help,
  wide,
  children,
}: {
  gem: GemId;
  /** Contenu du tiroir d'aide (règles de l'épreuve). Jamais de solution ni d'indice caché. */
  help?: ReactNode | ((ctx: { content: PublicInstance }) => ReactNode);
  wide?: boolean;
  children: (ctx: { content: PublicInstance; done: boolean }) => ReactNode;
}) {
  const candidate = await currentCandidate();
  if (!candidate) redirect("/session");
  const { view, now } = candidate;
  if (view.phase === "attente" || view.phase === "termine") redirect("/session");

  const content = loadPublicInstance(view.scenarioId, view.seed);
  const done = view.gems.includes(gem);
  return (
    <StageFrame
      gem={gem}
      title={content.stages[gem].title}
      story={content.stages[gem].story}
      gems={GEM_IDS.filter((g) => view.gems.includes(g))}
      deadlineIso={view.deadline ? view.deadline.toISOString() : null}
      serverNowIso={now.toISOString()}
      done={done}
      help={typeof help === "function" ? help({ content }) : help}
      wide={wide}
    >
      {children({ content, done })}
    </StageFrame>
  );
}
