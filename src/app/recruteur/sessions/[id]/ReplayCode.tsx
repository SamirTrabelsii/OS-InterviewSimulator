"use client";

import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { defineNightTheme, loadMonaco } from "@/app/session/CodeEditor";

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
    loadMonaco()
      .then((monaco) => {
        if (disposed || !host.current) return;
        const codeFont = getComputedStyle(host.current).getPropertyValue("--font-code").trim();
        editor.current = monaco.editor.create(host.current, {
          value: latest.current,
          language,
          readOnly: true,
          theme: defineNightTheme(monaco),
          ...(codeFont ? { fontFamily: `${codeFont}, ui-monospace, monospace` } : {}),
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

  return <div ref={host} style={{ height }} className="px-editor px-edge" />;
}
