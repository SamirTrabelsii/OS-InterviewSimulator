"use client";

import { useState, useTransition } from "react";
import { startSessionAction } from "./actions";

export function StartButton({ disabled, availableAt }: { disabled: boolean; availableAt: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const time = new Date(availableAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => start(async () => setError((await startSessionAction()).error ?? null))}
        className="rounded-md bg-indigo-600 px-6 py-3 text-lg font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Ouverture…" : "Commencer"}
      </button>
      {disabled && <p className="text-sm text-zinc-500">Le départ sera possible à {time}. Rechargez la page à ce moment-là.</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
