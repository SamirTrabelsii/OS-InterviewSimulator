import Link from "next/link";
import { Suspense } from "react";
import { requireRecruiter } from "@/server/auth/guard";
import { listScenarios } from "@/server/content/registry";
import { NewSlotForm } from "./NewSlotForm";

async function Guarded() {
  await requireRecruiter();
  const scenarios = listScenarios().map((s) => ({ id: s.id, label: `${s.title} — ${s.company}` }));
  return <NewSlotForm scenarios={scenarios} />;
}

export default function NouveauCreneauPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      <Link href="/recruteur" className="text-sm underline">
        ← Créneaux
      </Link>
      <h1 className="text-2xl font-semibold">Nouveau créneau</h1>
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <Guarded />
      </Suspense>
    </main>
  );
}
