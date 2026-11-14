"use client";

import { useState, useTransition } from "react";
import { devOpenPortalAction, type DevOpenState } from "./actions";
import { CopyLink } from "./CopyLink";

/** DEV UNIQUEMENT (affiché seulement si les raccourcis dev sont actifs). */
export function DevOpenPortal({ slotId }: { slotId: string }) {
  const [state, setState] = useState<DevOpenState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 space-y-1 rounded border border-dashed border-amber-500 p-2 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await devOpenPortalAction(slotId)))}
        className="text-amber-700 underline disabled:opacity-50 dark:text-amber-400"
      >
        [dev] Ouvrir le Portail maintenant (4 gemmes offertes)
      </button>
      {state?.status === "error" && (
        <p role="alert" className="text-red-600">
          {state.message}
        </p>
      )}
      {state?.status === "ok" &&
        state.links.map((l) => (
          <p key={l.url} className="flex flex-wrap items-center gap-2">
            <span>{l.name} :</span>
            <CopyLink url={l.url} />
          </p>
        ))}
    </div>
  );
}
