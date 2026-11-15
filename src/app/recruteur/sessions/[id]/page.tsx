import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireRecruiter } from "@/server/auth/guard";
import { LegacySheet } from "@/ui/pixel/control/LegacySheet";
import { ReviewClient } from "./ReviewClient";

async function Review({ params }: { params: Promise<{ id: string }> }) {
  await requireRecruiter();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  return (
    <>
      <Link href="/recruteur" className="text-sm underline">
        ← Créneaux
      </Link>
      <ReviewClient sessionId={id.data} />
    </>
  );
}

export default function SessionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LegacySheet>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-6">
        <Suspense fallback={<p className="text-zinc-500">Chargement…</p>}>
          <Review params={params} />
        </Suspense>
      </main>
    </LegacySheet>
  );
}
