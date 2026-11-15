"use client";

/** Date et heure du créneau dans le fuseau du navigateur du candidat. */
export function LocalDateTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

/** Heure (HH:MM) dans le fuseau du navigateur du candidat (le serveur est en UTC). */
export function LocalTime({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}
