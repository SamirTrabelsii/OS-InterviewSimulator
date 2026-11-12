"use client";

import type * as Monaco from "monaco-editor";
import { useEffect, useRef, useState } from "react";

// Monaco est servi par l'application (public/vendor/monaco, copié depuis
// node_modules par scripts/copy-vendor.mjs), jamais par un CDN. On charge
// sa version AMD avec un <script> : rien ne passe par le bundler.
const VS = "/vendor/monaco/vs";

type AmdRequire = ((deps: string[], ok: () => void, err: (e: unknown) => void) => void) & {
  config(c: { paths: Record<string, string> }): void;
};
type MonacoWindow = { require?: AmdRequire; monaco?: typeof Monaco };

let loading: Promise<typeof Monaco> | null = null;

function loadMonaco(): Promise<typeof Monaco> {
  loading ??= new Promise((resolve, reject) => {
    const w = window as unknown as MonacoWindow;
    if (w.monaco) return resolve(w.monaco);
    const script = document.createElement("script");
    script.src = `${VS}/loader.js`;
    script.onerror = () => reject(new Error("Éditeur introuvable"));
    script.onload = () => {
      w.require!.config({ paths: { vs: VS } });
      w.require!(["vs/editor/editor.main"], () => resolve(w.monaco!), reject);
    };
    document.head.appendChild(script);
  });
  loading.catch(() => (loading = null));
  return loading;
}

/**
 * Éditeur de code (Monaco). Non contrôlé : `initialValue` n'est lu qu'au
 * montage, `onChange` reçoit chaque modification. Ctrl/Cmd + Entrée
 * déclenche `onRun`.
 */
export function CodeEditor({
  language,
  initialValue,
  onChange,
  onRun,
  label,
  height = 280,
}: {
  language: "sql" | "python";
  initialValue: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  label: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onRun });
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState(initialValue);

  useEffect(() => {
    callbacks.current = { onChange, onRun };
  });

  useEffect(() => {
    let editor: Monaco.editor.IStandaloneCodeEditor | null = null;
    let disposed = false;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");

    loadMonaco()
      .then((monaco) => {
        if (disposed || !host.current) return;
        editor = monaco.editor.create(host.current, {
          value: initialValue,
          language,
          theme: dark.matches ? "vs-dark" : "vs",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: 4,
          insertSpaces: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          ariaLabel: label,
        });
        editor.onDidChangeModelContent(() => callbacks.current.onChange(editor!.getValue()));
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => callbacks.current.onRun?.());
        dark.onchange = (e) => monaco.editor.setTheme(e.matches ? "vs-dark" : "vs");
      })
      .catch(() => !disposed && setFailed(true));

    return () => {
      disposed = true;
      dark.onchange = null;
      editor?.dispose();
    };
    // Monté une seule fois : la valeur initiale ne doit pas écraser la saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    // Repli si l'éditeur ne se charge pas : simple zone de texte.
    return (
      <textarea
        aria-label={label}
        value={fallback}
        onChange={(e) => {
          setFallback(e.target.value);
          onChange(e.target.value);
        }}
        spellCheck={false}
        style={{ height }}
        className="w-full rounded-md border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
      />
    );
  }
  return <div ref={host} style={{ height }} className="overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700" />;
}
