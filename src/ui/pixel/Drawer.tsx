"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Tiroir repliable (Bip, indices). Contrôlé : l'appelant porte `open`.
 * Fermé, il est `inert` (ni focus ni lecteur d'écran). Échap le ferme.
 * À l'ouverture le focus passe au tiroir, à la fermeture il revient au déclencheur.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  return (
    <aside
      id="px-drawer"
      ref={ref}
      tabIndex={-1}
      role="complementary"
      aria-label={title}
      className="px-drawer"
      data-open={open}
      inert={!open}
    >
      <div className="px-drawer-head">
        <h2 className="px-panel-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <button type="button" className="px-drawer-close" onClick={onClose} aria-label="Fermer">
          X
        </button>
      </div>
      {children}
    </aside>
  );
}
