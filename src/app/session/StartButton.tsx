"use client";

import { useState, useTransition } from "react";
import { PixelButton, PixelStatus } from "@/ui/pixel/components";
import { startSessionAction } from "./actions";

export function StartButton({ disabled, availableAt }: { disabled: boolean; availableAt: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const time = new Date(availableAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="px-stack" style={{ alignItems: "flex-start" }}>
      <PixelButton
        variant="primary"
        disabled={disabled || pending}
        onClick={() => start(async () => setError((await startSessionAction()).error ?? null))}
        style={{ fontSize: "1.125rem", minWidth: "14rem" }}
      >
        {pending ? "Ouverture…" : "Commencer"}
      </PixelButton>
      {disabled && <p className="px-muted">Le départ sera possible à {time}. Rechargez la page à ce moment-là.</p>}
      {error && (
        <PixelStatus tone="bad">
          <p>{error}</p>
        </PixelStatus>
      )}
    </div>
  );
}
