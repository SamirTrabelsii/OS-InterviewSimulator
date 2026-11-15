import { Suspense } from "react";
import { requireRecruiter } from "@/server/auth/guard";
import { listScenarios } from "@/server/content/registry";
import { db } from "@/server/db/client";
import { devShortcutsEnabled } from "@/server/dev/shortcuts";
import { evaluatedSessionIds } from "@/server/grading/evaluations";
import { listSlots } from "@/server/slots/service";
import { DashboardView } from "./DashboardView";

async function Dashboard() {
  const recruiter = await requireRecruiter();
  const slots = await listSlots(db());
  const titles = new Map(listScenarios().map((s) => [s.id, s.title]));
  // Seulement ce que CE recruteur a noté : chacun note seul.
  const evaluated = await evaluatedSessionIds(db(), recruiter.email, slots.flatMap((s) => s.candidates.map((c) => c.sessionId)));
  return <DashboardView slots={slots} titles={titles} evaluated={evaluated} now={new Date()} devShortcuts={devShortcutsEnabled()} />;
}

export default function RecruteurPage() {
  return (
    <Suspense fallback={<main className="rc-main"><p className="rc-sub">Chargement…</p></main>}>
      <Dashboard />
    </Suspense>
  );
}
