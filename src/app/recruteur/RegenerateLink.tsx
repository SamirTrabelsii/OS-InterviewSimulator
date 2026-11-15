"use client";

import { useState, useTransition } from "react";
import { regenerateLinkAction } from "./actions";
import { CopyLink } from "./CopyLink";

export function RegenerateLink({ sessionId, control = false }: { sessionId: string; control?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (url) return <CopyLink url={url} control={control} />;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Générer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
        start(async () => setUrl((await regenerateLinkAction(sessionId)).url));
      }}
      className={control ? "px-btn px-btn-sm" : "text-sm text-blue-700 underline disabled:opacity-50 dark:text-blue-400"}
    >
      {control ? "Générer un lien" : "Nouveau lien"}
    </button>
  );
}
