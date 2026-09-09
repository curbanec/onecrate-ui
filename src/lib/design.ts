/**
 * Design system constants (DESIGN_SYSTEM.md §5, §6.1, §9).
 *
 * Values that are not colors but must live in one place. Colors live in
 * globals.css; anything here is a number the layout derives from.
 */

/** Closed trades required before a derived statistic is trustworthy (§6.1). */
export const EVIDENCE_THRESHOLD = 30;

/** Left nav rail width in px (§5.1). */
export const RAIL_WIDTH = 188;

/** Minimum executor row height in px (§5.4). */
export const ROW_MIN_HEIGHT = 36;

/**
 * The executor card spine (§5.4). Every card puts the same field at the same
 * horizontal position, so the column header row and the rows themselves must
 * read this one constant — two copies will drift.
 *
 *   ident  alloc  deploy  P&L   trades  signal  caret
 */
export const EXECUTOR_GRID = "300px 104px 104px 132px 104px 1fr 24px";

/** Isometric cube aspect, from the logo's 0 0 26 30 viewBox. */
const CUBE_W = 26;
const CUBE_H = 30;

/** Gutter between the cube column and the vertical hairline arm, in px. */
export const CUBE_GUTTER = 9;

/** Width of a hairline rule, px. */
export const HAIRLINE = 1;

export interface CrossConfig {
  /** Block offset from the top of the rail, px. */
  top: number;
  /** Vertical arm length downward from the top of the block, px. */
  arm: number;
  /** Horizontal arm extent left of the intersection, px. */
  armLeft: number;
  /** Distance both arms continue past the intersection, px. */
  stub: number;
  /** Intersection position across the rail, percent. */
  x: number;
  /** Requested cube height, px — clamped against the space left of the arm. */
  cubeSize: number;
}

/**
 * Defaults from §5.2. These match the canvas mockup's declared prop defaults;
 * the fallbacks inlined in `Fleet Directions.dc.html`'s renderVals() are stale
 * and disagree — the screenshots were rendered with these.
 */
export const CROSS_DEFAULTS: CrossConfig = {
  top: 7,
  arm: 126,
  armLeft: 108,
  stub: 25,
  x: 71,
  cubeSize: 86,
};

export interface CrossGeometry {
  /** Block offset from the top of the rail, px. */
  top: number;
  /** Intersection x, as a CSS percentage. */
  x: string;
  /** Total vertical span of the cross block, px. */
  total: number;
  /** Total horizontal span of the horizontal arm, px. */
  horizontal: number;
  /** margin-left applied to the horizontal arm so it extends leftward, px. */
  offset: number;
  /** y of the horizontal arm within the block, px. */
  armTop: number;
  /** Distance from the block's bottom to the wordmark baseline block, px. */
  logoBottom: number;
  /** Gap from the intersection to the rail's right edge, as a CSS percentage. */
  rightGap: number;
  /**
   * y of the horizontal arm measured from the top of the rail's padded box —
   * the line the header band has to meet.
   */
  armY: number;
  cubeWidth: number;
  cubeHeight: number;
  /**
   * Header band height (§5.3). The band's bottom rule has to sit at the same y
   * as the cross's horizontal arm — that alignment is the whole reason the
   * cross exists. Always derive it; never hardcode it in the band.
   *
   * This is `armY + HAIRLINE`, not the `crossTop + crossArm` the doc gives.
   * The band's border-bottom is drawn *inside* a border-box, so it occupies
   * the box's final row: a box of exactly `armY` lands its rule one pixel
   * short. The canvas mockup has the same off-by-one — its arm renders at
   * y=150 against a header rule at y=149.
   *
   * Assumes the rail and the content area share a padding value, which §5.1
   * fixes at 16px for both.
   */
  headerBandHeight: number;
}

/**
 * Resolve the hairline cross (§5.2) into concrete pixel geometry.
 *
 * The cube is clamped to the space left of the vertical arm so it can never
 * overhang the panel edge, and is centered on the wordmark by layout rather
 * than by a tuned pixel offset.
 */
export function crossGeometry(
  config: Partial<CrossConfig> = {},
  railWidth: number = RAIL_WIDTH,
): CrossGeometry {
  const { top, arm, armLeft, stub, x, cubeSize } = { ...CROSS_DEFAULTS, ...config };

  const available = Math.max(0, (railWidth * x) / 100 - CUBE_GUTTER);
  const cubeHeight = Math.max(
    0,
    Math.min(cubeSize, Math.round((available * CUBE_H) / CUBE_W)),
  );

  return {
    top,
    x: `${x}%`,
    total: arm + stub,
    horizontal: armLeft + stub,
    offset: -armLeft,
    armTop: arm,
    logoBottom: stub + 4,
    rightGap: 100 - x,
    cubeHeight,
    cubeWidth: Math.round((cubeHeight * CUBE_W) / CUBE_H),
    armY: top + arm,
    headerBandHeight: top + arm + HAIRLINE,
  };
}
