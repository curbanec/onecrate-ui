import { CUBE_GUTTER, crossGeometry, type CrossConfig } from "@/lib/design";
import { Wordmark } from "./wordmark";

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

      <span
        aria-hidden="true"
        className="bg-rule absolute h-px"
        style={{ left: g.x, top: g.armTop, width: g.horizontal, marginLeft: g.offset }}
      />
      <span
        aria-hidden="true"
        className="bg-rule absolute top-0 w-px"
        style={{ left: g.x, height: g.total }}
      />
    </div>
  );
}
