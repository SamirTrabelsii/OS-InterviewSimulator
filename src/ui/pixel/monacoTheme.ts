import { PALETTE as P } from "./world/art/palette";

const hex = (c: string) => c.slice(1);

/** Thème nuit de Monaco, construit uniquement avec la palette du quartier (Monaco n'accepte pas de variables CSS). */
export const NIGHT_THEME_DEF = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "keyword", foreground: hex(P.mgL) },
    { token: "string", foreground: hex(P.grL) },
    { token: "number", foreground: hex(P.am) },
    { token: "comment", foreground: hex(P.s1), fontStyle: "italic" },
    { token: "type", foreground: hex(P.cyL) },
  ],
  colors: {
    "editor.background": P.void,
    "editor.foreground": P.moon,
    "editorLineNumber.foreground": P.i2,
    "editorLineNumber.activeForeground": P.mist,
    "editor.lineHighlightBackground": P.n1,
    "editor.selectionBackground": P.i2,
    "editorCursor.foreground": P.cyL,
    "editorWidget.background": P.n2,
    "editorIndentGuide.background1": P.n3,
  },
};
