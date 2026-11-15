import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { isDevUiEnabled } from "@/ui/pixel/devOnly";
import { RecruiterShell } from "@/ui/pixel/control/RecruiterShell";
import { PixelPanel } from "@/ui/pixel/components";
import { LiveMap } from "@/ui/pixel/control/LiveMap";
import { DashboardView, type DashboardSlot } from "@/app/recruteur/DashboardView";

export const metadata: Metadata = { title: "Démo tableau de bord recruteur (dev)", robots: { index: false } };

// Données fictives : aucune base, aucune connexion. Le serveur fixe « maintenant ».
const titles = new Map([
  ["retail", "L'inventaire de minuit"],
  ["ecommerce", "La vente flash"],
]);

async function Demo() {
  await connection(); // « maintenant » est lu à la requête, pas au prérendu
  const now = new Date();
  const at = (min: number) => new Date(now.getTime() + min * 60_000);
  const slots: DashboardSlot[] = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      scenario: "retail",
      mode: "binome",
      status: "en_cours",
      scheduledAt: at(-22),
      candidates: [
        { sessionId: "11111111-1111-4111-8111-111111111111", name: "Amel Ben Salah", status: "en_cours", gems: ["quiz", "sql", "algo"], deadline: at(23) },
        { sessionId: "22222222-2222-4222-8222-222222222222", name: "Yassine Trabelsi", status: "en_cours", gems: ["quiz", "sql"], deadline: at(23) },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      scenario: "ecommerce",
      mode: "solo",
      status: "planifie",
      scheduledAt: at(180),
      candidates: [{ sessionId: "33333333-3333-4333-8333-333333333333", name: "Ines Gharbi", status: "en_attente", gems: [], deadline: null }],
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      scenario: "retail",
      mode: "binome",
      status: "termine",
      scheduledAt: at(-1500),
      candidates: [
        { sessionId: "44444444-4444-4444-8444-444444444444", name: "Mehdi Jlassi", status: "terminee", gems: ["quiz", "sql", "algo", "logique"], deadline: at(-1455) },
        { sessionId: "55555555-5555-4555-8555-555555555555", name: "Sarra Mejri", status: "terminee", gems: ["quiz", "sql", "algo"], deadline: at(-1455) },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000004",
      scenario: "ecommerce",
      mode: "solo",
      status: "termine",
      scheduledAt: at(-3000),
      candidates: [{ sessionId: "66666666-6666-4666-8666-666666666666", name: "Omar Kefi", status: "terminee", gems: ["quiz", "sql", "algo", "logique"], deadline: at(-2955) }],
    },
  ];
  // « Déjà noté par moi » : le dernier seulement.
  const evaluated = new Set(["66666666-6666-4666-8666-666666666666"]);
  return (
    <RecruiterShell>
      <DashboardView slots={slots} titles={titles} evaluated={evaluated} now={now} />
      <main className="rc-main">
        <PixelPanel title="Mini-carte (démo)">
          <LiveMap
            pins={[
              { sessionId: "11111111-1111-4111-8111-111111111111", name: "Amel Ben Salah", spot: "sql" },
              { sessionId: "22222222-2222-4222-8222-222222222222", name: "Yassine Trabelsi", spot: "sql" },
              { sessionId: "33333333-3333-4333-8333-333333333333", name: "Ines Gharbi", spot: "hub" },
            ]}
            done={["quiz"]}
            portalOpen={false}
            label="Démo de la mini-carte"
          />
        </PixelPanel>
      </main>
    </RecruiterShell>
  );
}

export default function DevRecruteurPage() {
  if (!isDevUiEnabled()) notFound();
  return (
    <Suspense fallback={null}>
      <Demo />
    </Suspense>
  );
}
