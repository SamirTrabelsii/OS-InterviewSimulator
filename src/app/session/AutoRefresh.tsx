"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge les données serveur de la page à intervalle régulier (le Portail s'ouvre sans action du candidat). */
export function AutoRefresh({ everyMs }: { everyMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
