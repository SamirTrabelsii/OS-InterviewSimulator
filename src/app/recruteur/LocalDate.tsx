"use client";

/** Date affichée dans le fuseau du navigateur du recruteur (le serveur est en UTC). */
export function LocalDate({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}
