import { AVATAR_SIZE, makeAvatar } from "./avatarCells";

/** Petit avatar pixel, décoratif (le nom est toujours écrit à côté). */
export function PixelAvatar({ seed, size = 5 }: { seed: string; size?: number }) {
  const { cells, tone } = makeAvatar(seed);
  return (
    <svg
      className="rc-avatar"
      data-tone={tone}
      width={AVATAR_SIZE * size}
      height={AVATAR_SIZE * size}
      viewBox={`0 0 ${AVATAR_SIZE} ${AVATAR_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden
    >
      {cells.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null)))}
    </svg>
  );
}
