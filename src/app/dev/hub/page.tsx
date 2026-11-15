import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NightShell } from "@/ui/pixel/NightShell";
import { isDevUiEnabled } from "@/ui/pixel/devOnly";
import { HubDemo } from "./HubDemo";

export const metadata: Metadata = { title: "Démo du monde du hub (dev)", robots: { index: false } };

export default function DevHubPage() {
  if (!isDevUiEnabled()) notFound();
  return (
    <NightShell>
      <HubDemo />
    </NightShell>
  );
}
