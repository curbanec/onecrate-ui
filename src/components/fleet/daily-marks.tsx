import type { Mark } from "@/lib/fleet";

/**
 * The two signal-slot renderers (§6.2), sharing one coordinate system.
 *
 * `DailyMarks` is for strategies that are flat on most days. Each trading day
 * is its own tick, positioned by date rather than by array index, which is what
 * makes a weekend read as absence instead of being closed up. NOT a sparkline:
 * a smooth line through those days claims movement that did not happen.
 *
 * `EquityLine` is for strategies that hold across days. There the position is
 * live through the gap, so a connected path is not claiming anything false.
 *
 * Ticks rather than dots because the slot is oversubscribed: 49 days across
 * 128px is 2.6px per day, and a dot wide enough to see overlaps its neighbours
 * and fuses into a dash. A 1.1px tick packs at that spacing, and length from
 * the zero baseline is easier to judge at 28px tall than position alone.
 *
 * Carried marks (§6.3) read as interruptions in the stroke rather than a
 * different colour — noticeable on inspection, invisible when scanning.
 */

const WIDTH = 132;
const HEIGHT = 28;
const PAD = 1.9;
const STROKE = 1.1;

interface Plot {
  x: (t: number) => number;
  y: (value: number) => number;
  zero: number;
}

function plot(marks: Mark[]): Plot {
  const times = marks.map((mark) => mark.t);
  const values = marks.map((mark) => mark.value);

  const t0 = Math.min(...times);
  const tSpan = Math.max(...times) - t0 || 1;

  // Zero is always inside the domain, so the baseline cannot fall off the plot
  // and a run of flat days sits on it rather than floating.
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = high - low || 1;

  const x = (t: number) => ((t - t0) / tSpan) * (WIDTH - PAD * 2) + PAD;
  const y = (value: number) =>
      HEIGHT - PAD - ((value - low) / span) * (HEIGHT - PAD * 2);

  return { x, y, zero: y(0) };
}

/**
 * The zero line (§2.7's `chart-reference`).
 *
 * `--chart-ref` is not a defined custom property — globals.css declares
 * `--color-chart-ref` inside `@theme inline`, which is a different name — so a
 * bare `var(--chart-ref)` is unresolvable, and because `stroke` is inherited the
 * declaration falls through to `none` and the line does not draw at all. The
 * theme name is kept first with `--flat` as the fallback, which is the value
 * §2.7 assigns to `chart-reference` anyway.
 */
function Baseline({ zero }: { zero: number }) {
  return (
      <line
          x1={0}
          x2={WIDTH}
          y1={zero}
          y2={zero}
          stroke="var(--color-chart-ref, var(--flat))"
          strokeDasharray="3 3"
          strokeWidth={1}
      />
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
      <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={label}
          className="block"
      >
        {children}
      </svg>
  );
}

/**
 * Discrete daily ticks, for `intraday` and `pairs` characters.
 *
 * A flat day is a zero-length tick, which `strokeLinecap="round"` renders as a
 * dot on the baseline. That is deliberate: roughly four days in five are flat
 * on an intraday strategy, so without it most of the plot would be empty.
 */
export function DailyMarks({ marks, label }: { marks: Mark[]; label: string }) {
  if (marks.length === 0) return null;

  const { x, y, zero } = plot(marks);

  return (
      <Frame label={label}>
        <Baseline zero={zero} />
        {marks.map((mark) => (
            <line
                key={mark.date}
                x1={x(mark.t)}
                x2={x(mark.t)}
                y1={zero}
                y2={y(mark.value)}
                stroke={mark.carried ? "var(--flat)" : "var(--ink)"}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={mark.carried ? "1 1" : undefined}
            />
        ))}
      </Frame>
  );
}

/**
 * A connected equity path, for the `continuous` character.
 *
 * Carried points keep the §6.3 hollow-circle treatment rather than breaking the
 * stroke — the position was held through that day, so the line is not lying;
 * only the valuation behind one of its points is second-hand.
 */
export function EquityLine({ marks, label }: { marks: Mark[]; label: string }) {
  if (marks.length === 0) return null;

  const { x, y, zero } = plot(marks);

  const path = marks
      .map((mark, i) => `${i === 0 ? "M" : "L"} ${x(mark.t)} ${y(mark.value)}`)
      .join(" ");

  return (
      <Frame label={label}>
        <Baseline zero={zero} />
        <path
            d={path}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
        />
        {marks
            .filter((mark) => mark.carried)
            .map((mark) => (
                <circle
                    key={mark.date}
                    cx={x(mark.t)}
                    cy={y(mark.value)}
                    r={2.2}
                    fill="none"
                    stroke="var(--flat)"
                    strokeWidth={1.1}
                />
            ))}
      </Frame>
  );
}