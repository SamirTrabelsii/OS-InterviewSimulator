import Link from "next/link";
import { Suspense } from "react";
import { requireRecruiter } from "@/server/auth/guard";
import { listScenarios } from "@/server/content/registry";
import { db } from "@/server/db/client";
import { listSlots } from "@/server/slots/service";
import { signOutRecruiter } from "./actions";
import { LocalDate } from "./LocalDate";
import { RegenerateLink } from "./RegenerateLink";

const STATUS: Record<string, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
  en_attente: "En attente",
  terminee: "Terminée",
  expiree: "Expirée",
};

async function Dashboard() {
  const recruiter = await requireRecruiter();
  const slots = await listSlots(db());
  const titles = new Map(listScenarios().map((s) => [s.id, s.title]));

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Créneaux d&apos;entretien</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">{recruiter.email}</span>
          <form action={signOutRecruiter}>
            <button className="underline">Se déconnecter</button>
          </form>
        </div>
      </header>

      <Link
        href="/recruteur/creneaux/nouveau"
        className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Nouveau créneau
      </Link>

      {slots.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">Aucun créneau pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-3">
          {slots.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{titles.get(s.scenario) ?? s.scenario}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  <LocalDate iso={s.scheduledAt.toISOString()} /> · {s.mode === "solo" ? "Solo" : "Binôme"} ·{" "}
                  {STATUS[s.status] ?? s.status}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {s.candidates.map((c) => (
                  <li key={c.sessionId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {c.name} — {STATUS[c.status] ?? c.status} · {c.gems.length}/4 gemmes
                    </span>
                    {c.status === "en_attente" && <RegenerateLink sessionId={c.sessionId} />}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function RecruteurPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}
