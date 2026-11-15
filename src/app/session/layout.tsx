import type { ReactNode } from "react";
import { NightShell } from "@/ui/pixel/NightShell";

/** Tout le parcours candidat (/session/**) est en thème nuit ; le recruteur n'en dépend pas. */
export default function SessionLayout({ children }: { children: ReactNode }) {
  return <NightShell className="px-fill">{children}</NightShell>;
}
