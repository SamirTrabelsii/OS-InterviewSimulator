"use client";

import { useState, useTransition } from "react";
import { devOpenPortalAction, type DevOpenState } from "./actions";
import { CopyLink } from "./CopyLink";

/** DEV UNIQUEMENT (affiché seulement si les raccourcis dev sont actifs). */
export function DevOpenPortal({ slotId }: { slotId: string }) {
  const [state, setState] = useState<DevOpenState | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rc-dev">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await devOpenPortalAction(slotId)))}
        className="rc-link"
      >
        [dev] Ouvrir le Portail maintenant (4 gemmes offertes)
      </button>
      {state?.status === "error" && <p role="alert">{state.message}</p>}
      {state?.status === "ok" &&
        state.links.map((l) => (
          <p key={l.url}>
            <span>{l.name} :</span> <CopyLink url={l.url} />
          </p>
        ))}
    </div>
  );
}
