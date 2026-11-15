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

const NIGHT_THEME = "portail-night";
// Palette du thème nuit (src/ui/pixel/tokens.css), en dur : Monaco n'accepte pas de variables CSS.
const NIGHT_DEF: Monaco.editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "ff4fd8" },
    { token: "string", foreground: "4dffa6" },
    { token: "number", foreground: "ffb547" },
    { token: "comment", foreground: "5a6196", fontStyle: "italic" },
    { token: "type", foreground: "3ef0ff" },
  ],
  colors: {
    "editor.background": "#07080f",
    "editor.foreground": "#e8e6ff",
    "editorLineNumber.foreground": "#3a4170",
    "editorLineNumber.activeForeground": "#a7a3d1",
    "editor.lineHighlightBackground": "#10132a",
    "editor.selectionBackground": "#3a4170",
    "editorCursor.foreground": "#3ef0ff",
    "editorWidget.background": "#151933",
    "editorIndentGuide.background1": "#1a1d36",
  },
};

/** Enregistre le thème nuit dans Monaco et renvoie son nom (aussi utilisé par le replay recruteur). */
export function defineNightTheme(monaco: typeof Monaco): string {
  monaco.editor.defineTheme(NIGHT_THEME, NIGHT_DEF);
  return NIGHT_THEME;
}

let loading: Promise<typeof Monaco> | null = null;

export function loadMonaco(): Promise<typeof Monaco> {
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
  night = false,
}: {
  language: "sql" | "python";
  initialValue: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  label: string;
  height?: number;
  /** Thème pixel nuit du côté candidat (sinon : clair/sombre du système). */
  night?: boolean;
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
        if (night) monaco.editor.defineTheme(NIGHT_THEME, NIGHT_DEF);
        const codeFont = getComputedStyle(host.current).getPropertyValue("--font-code").trim();
        editor = monaco.editor.create(host.current, {
          value: initialValue,
          language,
          theme: night ? NIGHT_THEME : dark.matches ? "vs-dark" : "vs",
          ...(night && codeFont ? { fontFamily: `${codeFont}, ui-monospace, monospace` } : {}),
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
        if (!night) dark.onchange = (e) => monaco.editor.setTheme(e.matches ? "vs-dark" : "vs");
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
        className={night ? "px-textarea px-edge" : "w-full rounded-md border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"}
      />
    );
  }
  return (
    <div
      ref={host}
      style={{ height }}
      className={night ? "px-editor px-edge" : "overflow-hidden rounded-md border border-zinc-300 dark:border-zinc-700"}
    />
  );
}
