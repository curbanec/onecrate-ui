import { cn } from "@/lib/utils";
import { isEvidenceStrong } from "@/lib/fleet";
import { Missing } from "./missing";

/**
 * U+2212, not a hyphen. It matches the plus sign's width in tabular figures,
 * so a column of signed numbers stays aligned (§7).
 */
const MINUS = "−";

/**
 * How a figure earns its color. The same number means different things in
 * different columns, and this is the distinction the mockup encodes as
 * `pnlColor` vs `evidence`.
 */
export type FigureTone =
  /** `ink`. Quantities that are simply facts — allocated capital, counts. */
  | "neutral"
  /** `gain`/`loss`/`flat` by sign. Results: P&L, returns. */
  | "direction"
  /** `ink` at or above threshold, `flat` below — the figure recedes (§6.1). */
  | "evidence";

/** §3.1. The largest figure on the page is 20px; nothing here exceeds it. */
export type FigureSize = "lg" | "md" | "sm";

export type FigureFormat = "currency" | "percent" | "number";

interface FigureBase {
  /** null renders as an em dash, never as zero (§6.7). */
  value: number | null;
  size?: FigureSize;
  format?: FigureFormat;
  /** Force a leading + on positives. Results want this; counts do not. */
  signed?: boolean;
  /** Fraction digits. Defaults to 2 for currency and percent, 0 for counts. */
  precision?: number;
  /** Prefix a hollow dot marking a mark carried forward, not observed (§6.3). */
  carried?: boolean;
  className?: string;
}

/**
 * `evidence` tone requires a sample size — without one there is nothing to
 * judge the figure against, and defaulting it would quietly present weak data
 * as strong.
 */
export type FigureProps = FigureBase &
  (
    | { tone?: "neutral" | "direction"; sampleSize?: never }
    | { tone: "evidence"; sampleSize: number }
  );

const SIZES: Record<FigureSize, string> = {
  lg: "text-data-lg",
  md: "text-data",
  sm: "text-data-sm",
};

function directionTone(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-flat";
}

function format(
  value: number,
  style: FigureFormat,
  signed: boolean,
  precision: number,
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: style === "currency" ? "currency" : style === "percent" ? "percent" : "decimal",
    currency: "USD",
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    signDisplay: signed ? "always" : "auto",
    // Percent values arrive in percent units (3.48 → "3.48%"), matching how
    // they are stored and summed.
  }).format(style === "percent" ? value / 100 : value);

  return formatted.replace(/-/g, MINUS);
}

/**
 * Any number on the page.
 *
 * Always set in the numeric face with tabular figures — a figure in a
 * proportional face without tabular numerals is listed under §8 as a defect.
 */
export function Figure({
  value,
  tone = "neutral",
  size = "md",
  format: style = "number",
  signed = false,
  precision,
  carried = false,
  sampleSize,
  className,
}: FigureProps) {
  if (value === null || Number.isNaN(value)) {
    return <Missing className={cn(SIZES[size], className)} />;
  }

  const digits = precision ?? (style === "number" ? 0 : 2);

  const color =
    tone === "direction"
      ? directionTone(value)
      : tone === "evidence" && !isEvidenceStrong(sampleSize as number)
        ? "text-flat"
        : "text-ink";

  return (
    <span className={cn("font-numeric tabular-nums", SIZES[size], color, className)}>
      {carried && (
        <>
          {/* Noticeable on inspection, invisible when scanning. A color would
              be too loud for something this common (§6.3). */}
          <span aria-hidden="true" className="text-flat mr-[5px]">
            ◦
          </span>
          <span className="sr-only">carried mark, </span>
        </>
      )}
      {format(value, style, signed, digits)}
    </span>
  );
}
