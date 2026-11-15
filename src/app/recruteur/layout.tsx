import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { currentRecruiter } from "@/server/auth/guard";
import { RecruiterShell } from "@/ui/pixel/control/RecruiterShell";
import { signOutRecruiter } from "./actions";

export const metadata: Metadata = { title: "Salle de contrôle · Le Portail", robots: { index: false } };

/** Compte connecté ; rien à afficher sur la page de connexion. */
async function Account() {
  const recruiter = await currentRecruiter();
  if (!recruiter) return null;
  return (
    <div className="rc-account">
      <span>{recruiter.email}</span>
      <form action={signOutRecruiter}>
        <button type="submit">Se déconnecter</button>
      </form>
    </div>
  );
}

/** Gabarit commun de tout l'espace recruteur : en-tête, navigation, compte. */
export default function RecruiterLayout({ children }: { children: ReactNode }) {
  return (
    <RecruiterShell>
      <header className="rc-header">
        <div className="rc-header-in">
          <Link href="/recruteur" className="rc-brand">
            Le Portail
            <small>Salle de contrôle</small>
          </Link>
          <nav className="rc-nav" aria-label="Navigation recruteur">
            <Link href="/recruteur">Missions</Link>
            <Link href="/recruteur/creneaux/nouveau">Nouvelle mission</Link>
          </nav>
          <Suspense fallback={null}>
            <Account />
          </Suspense>
        </div>
      </header>
      {children}
    </RecruiterShell>
  );
}
