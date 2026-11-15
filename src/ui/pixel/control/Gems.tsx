import { GemIcon, type GemId } from "../components";

const ORDER: GemId[] = ["quiz", "sql", "algo", "logique"];

/** Avancement d'un candidat : les 4 gemmes, allumées ou éteintes. */
export function GemRow({ gems }: { gems: readonly string[] }) {
  return (
    <span className="rc-gems" role="group" aria-label={`${ORDER.filter((g) => gems.includes(g)).length} gemmes sur 4`}>
      {ORDER.map((g) => (
        <GemIcon key={g} gem={g} lit={gems.includes(g)} />
      ))}
    </span>
  );
}
