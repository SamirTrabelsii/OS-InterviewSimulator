"use client";

import { useState } from "react";

export function CopyLink({ url, control = false }: { url: string; control?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };
  if (control) {
    return (
      <span className="rc-copy">
        <code>{url}</code>
        <button type="button" onClick={copy} className="px-btn px-btn-sm">
          {copied ? "Copié" : "Copier le lien"}
        </button>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <code className="min-w-0 truncate rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{url}</code>
      <button type="button" onClick={copy} className="shrink-0 text-sm text-blue-700 underline dark:text-blue-400">
        {copied ? "Copié" : "Copier"}
      </button>
    </span>
  );
}
