/**
 * The isometric cube and wordmark, as one center-aligned stack.
 *
 * The cube is centered on the wordmark by layout, never by a tuned pixel
 * offset (§5.2) — the flex column does the centering, so changing the cube
 * size cannot knock it out of alignment.
 */

/**
 * Brand tint for the cube's top face. Deliberately local: it is the one color
 * on the page outside the §2 set, and it earns that only by being part of the
 * mark rather than the interface.
 */
const CUBE_TOP = "#8E76D6";

export function Wordmark({
  cubeWidth,
  cubeHeight,
  cubeShiftX = 0,
}: {
  cubeWidth: number;
  cubeHeight: number;
  /** Horizontal nudge for the cube alone, px. */
  cubeShiftX?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-[10px]">
      <svg
        width={cubeWidth}
        height={cubeHeight}
        viewBox="0 0 26 30"
        className="block"
        style={{ transform: `translateX(${cubeShiftX}px)` }}
        role="img"
        aria-label="OneCrate"
      >
        <polygon points="0,7.5 13,15 13,30 0,22.5" fill="var(--accent)" />
        <polygon points="13,0 26,7.5 13,15 0,7.5" fill={CUBE_TOP} />
        <polygon points="26,7.5 26,22.5 13,30 13,15" fill="var(--accent-ink)" />
      </svg>
      <span className="text-[22px] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap">
        OneCrate
      </span>
    </div>
  );
}
