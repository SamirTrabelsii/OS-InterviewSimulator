import type { ReactNode } from "react";
import { fontCode, fontPixel, fontRead, fontUi } from "./fonts";
import "./tokens.css";
import "./pixel.css";

/**
 * Enveloppe du côté candidat : charge les polices, les jetons et applique le
 * thème nuit. À placer autour d'un écran candidat ; le recruteur ne l'utilise pas.
 */
export function NightShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  const fonts = [fontPixel, fontUi, fontRead, fontCode].map((f) => f.variable).join(" ");
  return <div className={`theme-night ${fonts} ${className}`}>{children}</div>;
}
