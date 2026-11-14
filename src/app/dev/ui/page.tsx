import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NightShell } from "@/ui/pixel/NightShell";
import { isDevUiEnabled } from "@/ui/pixel/devOnly";
import { UiDemo } from "./UiDemo";

export const metadata: Metadata = { title: "Démo composants (dev)", robots: { index: false } };

export default function DevUiPage() {
  if (!isDevUiEnabled()) notFound();
  return (
    <NightShell>
      <UiDemo />
    </NightShell>
  );
}
