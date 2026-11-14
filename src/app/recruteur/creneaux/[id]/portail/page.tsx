import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireRecruiter } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { loadSlotInfo } from "@/server/portal/pg";
import { ObserverView } from "./ObserverView";

async function Observe({ params }: { params: Promise<{ id: string }> }) {
  await requireRecruiter();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const info = await loadSlotInfo(db(), id.data);
  if (!info) notFound();
  return (
    <>
      <Link href="/recruteur" className="text-sm underline">
        ← Créneaux
      </Link>
      <ObserverView
        slotId={info.slotId}
        started={info.t0 !== null}
        candidates={info.members.map((m) => ({ sessionId: m.sessionId, name: m.name, status: m.status, gems: m.gems.length, started: m.startedAt !== null }))}
      />
    </>
  );
}

export default function ObservePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-6">
      <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
        <Observe params={params} />
      </Suspense>
    </main>
  );
}
