import { CUBE_GUTTER, crossGeometry, type CrossConfig } from "@/lib/design";
import { Wordmark } from "./wordmark";

/**
 * The signature element (§5.2): a structural alignment mark in `rule`, with
 * the logo stack anchored to its vertical arm and sitting just above the
 * horizontal one.
 *
 * `rule` is deliberately stronger than `hair` — this is structure, not a
 * separator, and it is the only place on the page that says so.
 *
 * The block bleeds past the rail's padding on both sides so the arms can run
 * to the rail edges; callers pass that padding as `bleed`.
 */
export function HairlineCross({
  config,
  bleed = 16,
  cubeShiftX = 0,
}: {
  config?: Partial<CrossConfig>;
  bleed?: number;
  cubeShiftX?: number;
}) {
  const g = crossGeometry(config);

  return (
    <div
      className="relative"
      style={{
        height: g.total,
        marginTop: g.top,
        marginLeft: -bleed,
        marginRight: -bleed,
      }}
    >
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: `${g.rightGap}%`,
          bottom: g.logoBottom,
          paddingRight: CUBE_GUTTER,
        }}
      >
        <Wordmark
          cubeWidth={g.cubeWidth}
          cubeHeight={g.cubeHeight}
          cubeShiftX={cubeShiftX}
        />
      </div>

      {/* Horizontal arm — the Fleet header band's bottom rule lands on this y. */}
      <span
        aria-hidden="true"
        className="bg-rule absolute h-px"
        style={{ left: g.x, top: g.armTop, width: g.horizontal, marginLeft: g.offset }}
      />
      {/* Vertical arm */}
      <span
        aria-hidden="true"
        className="bg-rule absolute top-0 w-px"
        style={{ left: g.x, height: g.total }}
      />
    </div>
  );
}
