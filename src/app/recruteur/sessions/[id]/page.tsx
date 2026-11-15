import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireRecruiter } from "@/server/auth/guard";
import { ReviewClient } from "./ReviewClient";

async function Review({ params }: { params: Promise<{ id: string }> }) {
  await requireRecruiter();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  return (
    <>
      <Link href="/recruteur" className="rv-back">
        ← Missions
      </Link>
      <ReviewClient sessionId={id.data} />
    </>
  );
}

export default function SessionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="rc-main rv-main">
      <Suspense fallback={<p className="rc-sub">Chargement…</p>}>
        <Review params={params} />
      </Suspense>
    </main>
  );
}
