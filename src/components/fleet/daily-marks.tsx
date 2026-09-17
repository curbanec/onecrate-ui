import type { Mark } from "@/lib/fleet";

/**
 * Discrete daily marks for the signal slot (§6.2, §6.6).
 *
 * NOT a sparkline. An intraday strategy is flat on most days, and a smooth line
 * through those days claims movement that did not happen. So each trading day
 * is its own mark, positioned by date rather than by array index, which is what
 * makes a weekend read as absence instead of being closed up.
 *
 * Carried marks render hollow (§6.3) — noticeable on inspection, invisible when
 * scanning, which is the intended weight for a fact this small.
 */

const WIDTH = 132;
const HEIGHT = 28;
const RADIUS = 1.9;

export function DailyMarks({ marks, label }: { marks: Mark[]; label: string }) {
  if (marks.length === 0) return null;

  const times = marks.map((mark) => mark.t);
  const values = marks.map((mark) => mark.value);

  const t0 = Math.min(...times);
  const tSpan = Math.max(...times) - t0 || 1;

  // Zero is always inside the domain, so the baseline cannot fall off the plot
  // and a run of flat days sits on it rather than floating.
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = high - low || 1;

  const x = (t: number) => ((t - t0) / tSpan) * (WIDTH - RADIUS * 2) + RADIUS;
  const y = (value: number) =>
    HEIGHT - RADIUS - ((value - low) / span) * (HEIGHT - RADIUS * 2);

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
      className="block"
    >
      <line
        x1={0}
        x2={WIDTH}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--chart-ref)"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      {marks.map((mark) =>
        mark.carried ? (
          <circle
            key={mark.date}
            cx={x(mark.t)}
            cy={y(mark.value)}
            r={RADIUS + 0.6}
            fill="none"
            stroke="var(--flat)"
            strokeWidth={1.1}
          />
        ) : (
          <circle
            key={mark.date}
            cx={x(mark.t)}
            cy={y(mark.value)}
            r={RADIUS}
            fill="var(--ink)"
          />
        ),
      )}
    </svg>
  );
}
