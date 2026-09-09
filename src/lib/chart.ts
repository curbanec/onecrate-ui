/**
 * Projection math for the platform chart.
 *
 * Kept out of the component so the one rule that matters here — that a gap in
 * the data becomes a gap on the x axis (§6.6) — is a pure function that can be
 * checked without rendering anything.
 */

import type { Mark } from "./fleet";

export interface ChartBox {
  width: number;
  /** Plot height. The viewBox is taller, leaving slack for markers at y=0. */
  height: number;
  /** Headroom above the highest point, px. */
  padTop: number;
  viewBoxHeight: number;
}

export const CHART_BOX: ChartBox = {
  width: 1060,
  height: 168,
  padTop: 10,
  viewBoxHeight: 178,
};

export interface Point {
  x: number;
  y: number;
  carried: boolean;
}

export interface Projection {
  series: Point[][];
  /** y of the 0% reference line. */
  zeroY: number;
  box: ChartBox;
}

/**
 * Project one or more series into the chart box on a shared scale.
 *
 * x comes from each mark's timestamp, never its array index — that is what
 * makes a weekend read as absence instead of being silently closed up. Zero is
 * always inside the y domain, so the reference line cannot fall off the plot.
 */
export function projectSeries(
  series: Mark[][],
  box: ChartBox = CHART_BOX,
): Projection {
  const all = series.flat();

  if (all.length === 0) {
    return { series: series.map(() => []), zeroY: box.height, box };
  }

  const t0 = Math.min(...all.map((m) => m.t));
  const span_t = Math.max(...all.map((m) => m.t)) - t0 || 1;
  const lo = Math.min(0, ...all.map((m) => m.value));
  const hi = Math.max(0, ...all.map((m) => m.value));
  const span = hi - lo || 1;

  const x = (t: number) => ((t - t0) / span_t) * box.width;
  const y = (value: number) =>
    box.padTop + ((hi - value) / span) * (box.height - box.padTop);

  return {
    series: series.map((marks) =>
      marks.map((m) => ({ x: x(m.t), y: y(m.value), carried: m.carried })),
    ),
    zeroY: y(0),
    box,
  };
}

/** SVG `points` attribute for a projected series. */
export function polylinePoints(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
