import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireRecruiter } from "@/server/auth/guard";
import { db } from "@/server/db/client";
import { loadSlotInfo } from "@/server/portal/pg";
import { loadSpots } from "@/server/recruteur/spots";
import { ObserverView } from "./ObserverView";

async function Observe({ params }: { params: Promise<{ id: string }> }) {
  await requireRecruiter();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const info = await loadSlotInfo(db(), id.data);
  if (!info) notFound();
  const spots = await loadSpots(db(), info.members);
  return (
    <>
      <Link href="/recruteur" className="rv-back">
        ← Missions
      </Link>
      <ObserverView
        slotId={info.slotId}
        started={info.t0 !== null}
        candidates={info.members.map((m) => ({ sessionId: m.sessionId, name: m.name, status: m.status, gems: m.gems, started: m.startedAt !== null, spot: spots[m.sessionId] ?? null }))}
      />
    </>
  );
}

export default function ObservePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="rc-main">
      <Suspense fallback={<p className="rc-sub">Chargement…</p>}>
        <Observe params={params} />
      </Suspense>
    </main>
  );
}
