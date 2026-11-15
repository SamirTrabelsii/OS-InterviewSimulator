"use client";

import { useState } from "react";

/** Lien candidat à copier (affiché une seule fois à la création, ou après « Générer un lien »). */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="rc-copy">
      <code>{url}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
        className="px-btn px-btn-sm"
      >
        {copied ? "Copié" : "Copier le lien"}
      </button>
    </span>
  );
}
