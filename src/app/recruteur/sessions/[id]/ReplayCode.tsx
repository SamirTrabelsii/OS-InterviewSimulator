"use client";

import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { loadMonaco } from "@/app/session/CodeEditor";

/** Monaco en lecture seule : le contenu suit `value` (replay). */
export function ReplayCode({ value, language, height = 320 }: { value: string; language: "sql" | "python"; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  useEffect(() => {
    let disposed = false;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    loadMonaco()
      .then((monaco) => {
        if (disposed || !host.current) return;
        editor.current = monaco.editor.create(host.current, {
          value: latest.current,
          language,
          readOnly: true,
          theme: dark.matches ? "vs-dark" : "vs",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          ariaLabel: "Code du candidat (lecture seule)",
        });
      })
      .catch(() => {}); // éditeur introuvable : le panneau reste vide, le replay textuel continue
    return () => {
      disposed = true;
      editor.current?.dispose();
      editor.current = null;
    };
  }, [language]);

  useEffect(() => {
    const e = editor.current;
    if (e && e.getValue() !== value) e.setValue(value);
  }, [value]);

  return <div ref={host} style={{ height }} className="overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700" />;
}
