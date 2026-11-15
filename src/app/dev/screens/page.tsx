import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NightShell } from "@/ui/pixel/NightShell";
import { PixelButton } from "@/ui/pixel/components";
import { isDevUiEnabled } from "@/ui/pixel/devOnly";
import { ReportScreen, WelcomeScreen } from "@/app/session/Screens";

export const metadata: Metadata = { title: "Démo des écrans d'accueil et de fin (dev)", robots: { index: false } };

const TITLES = {
  quiz: "Gemme du Savoir",
  sql: "Gemme des Données",
  algo: "Gemme du Calcul",
  logique: "Gemme de l'Esprit",
};
const EPILOGUE = "Le Portail s'ouvre sur un rayon bien rangé : les 40 boutiques de Maison Lumen ouvriront à l'heure.";

function Section({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section aria-label={name} style={{ borderTop: "4px dashed var(--c-line-2)", paddingBottom: "2rem" }}>
      <p className="px-stepper-label" style={{ padding: "1rem 1.5rem 0" }}>
        Démo : {name}
      </p>
      {children}
    </section>
  );
}

export default function DevScreensPage() {
  if (!isDevUiEnabled()) notFound();
  return (
    <NightShell>
      <Section name="accueil, départ possible">
        <WelcomeScreen
          company="Maison Lumen"
          title="L'inventaire de minuit"
          pitch="Quarante boutiques, un inventaire qui ne tombe pas juste, et une nuit pour comprendre pourquoi."
          mode="binome"
          action={<PixelButton variant="primary">Commencer</PixelButton>}
        />
      </Section>
      <Section name="rapport : Portail franchi">
        <ReportScreen company="Maison Lumen" retired={false} gems={["quiz", "sql", "algo", "logique"]} stageTitles={TITLES} portalSolved epilogue={EPILOGUE} minutes={38} />
      </Section>
      <Section name="rapport : temps écoulé, gemmes partielles">
        <ReportScreen company="Maison Lumen" retired={false} gems={["quiz", "logique"]} stageTitles={TITLES} portalSolved={false} epilogue={EPILOGUE} minutes={45} />
      </Section>
      <Section name="rapport : session clôturée par le recruteur">
        <ReportScreen company="Maison Lumen" retired gems={[]} stageTitles={TITLES} portalSolved={false} epilogue={EPILOGUE} minutes={null} />
      </Section>
    </NightShell>
  );
}
