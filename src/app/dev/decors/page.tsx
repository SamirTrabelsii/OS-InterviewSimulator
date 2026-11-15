import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NightShell } from "@/ui/pixel/NightShell";
import { PixelPanel } from "@/ui/pixel/components";
import { isDevUiEnabled } from "@/ui/pixel/devOnly";
import { Backdrop } from "@/ui/pixel/world/Backdrop";
import { INTERIOR_IDS, type InteriorId } from "@/ui/pixel/world/art/interiors";

export const metadata: Metadata = { title: "Décors d'intérieur (dev)", robots: { index: false } };

/** Démo dev : chaque décor derrière un énoncé et une zone de code factices (?id=savoir|archives|calcul|intuition|portail). */
export default async function DecorsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!isDevUiEnabled()) notFound();
  const { id } = await searchParams;
  const current = (INTERIOR_IDS as string[]).includes(id ?? "") ? (id as InteriorId) : "savoir";
  return (
    <NightShell className="px-fill">
      <Backdrop id={current} />
      <div className="px-stage">
        <div className="px-stage-head">
          {INTERIOR_IDS.map((i) => (
            <Link key={i} href={`/dev/decors?id=${i}`} className="px-link">
              {i === current ? `[${i}]` : i}
            </Link>
          ))}
        </div>
        <PixelPanel tone="cyan">
          <p className="px-read px-story">Énoncé factice : le décor reste sur les bords et ne gêne pas la lecture de ce texte.</p>
        </PixelPanel>
        <PixelPanel tone="green" title="Éditeur">
          <pre className="px-code" style={{ margin: 0, minHeight: "12rem" }}>{"SELECT boutique, SUM(qte)\nFROM stock\nGROUP BY boutique;"}</pre>
        </PixelPanel>
      </div>
    </NightShell>
  );
}
