import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NightShell } from "@/ui/pixel/NightShell";
import { isDevUiEnabled } from "@/ui/pixel/devOnly";
import { PlancheView } from "./PlancheView";

export const metadata: Metadata = { title: "Planche de sprites du hub (dev)", robots: { index: false } };

export default function DevPlanchePage() {
  if (!isDevUiEnabled()) notFound();
  return (
    <NightShell>
      <PlancheView />
    </NightShell>
  );
}
