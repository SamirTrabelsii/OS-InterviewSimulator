import Link from "next/link";
import { Suspense } from "react";
import { requireRecruiter } from "@/server/auth/guard";
import { listScenarios } from "@/server/content/registry";
import "@/ui/pixel/control/form.css";
import { NewSlotForm } from "./NewSlotForm";

async function Guarded() {
  await requireRecruiter();
  const scenarios = listScenarios().map((s) => ({ id: s.id, label: `${s.title} — ${s.company}` }));
  return <NewSlotForm scenarios={scenarios} />;
}

export default function NouveauCreneauPage() {
  return (
    <main className="rc-main fm-narrow">
      <Link href="/recruteur" className="rv-back">
        ← Missions
      </Link>
      <div>
        <h1 className="rc-h1">
          <abbr className="rc-term" title="Mission = créneau d'entretien">
            Nouvelle mission
          </abbr>
        </h1>
        <p className="rc-sub">Un créneau d&apos;entretien : un scénario, une heure, un ou deux candidats.</p>
      </div>
      <Suspense fallback={<p className="rc-sub">Chargement…</p>}>
        <Guarded />
      </Suspense>
    </main>
  );
}
