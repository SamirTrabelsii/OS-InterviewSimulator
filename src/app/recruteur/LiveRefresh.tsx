"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge les données du tableau de bord toutes les 30 s (onglet visible seulement), sans animation. */
export function LiveRefresh({ everyMs = 30_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
