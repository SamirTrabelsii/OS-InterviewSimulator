"use client";

import { useState, useTransition } from "react";
import { regenerateLinkAction } from "./actions";
import { CopyLink } from "./CopyLink";

export function RegenerateLink({ sessionId }: { sessionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (url) return <CopyLink url={url} />;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Générer un nouveau lien ? L'ancien ne fonctionnera plus.")) return;
        start(async () => setUrl((await regenerateLinkAction(sessionId)).url));
      }}
      className="px-btn px-btn-sm"
    >
      Générer un lien
    </button>
  );
}
