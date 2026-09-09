import { cn } from "@/lib/utils";
import { isEvidenceStrong } from "@/lib/fleet";
import { Missing } from "./missing";

const MINUS = "−";

export type FigureTone =
  | "neutral"
  | "direction"
  | "evidence";

export type FigureSize = "lg" | "md" | "sm";

export type FigureFormat = "currency" | "percent" | "number";

interface FigureBase {
  value: number | null;
  size?: FigureSize;
  format?: FigureFormat;
  signed?: boolean;
  precision?: number;
  carried?: boolean;
  className?: string;
}

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
  }).format(style === "percent" ? value / 100 : value);

  return formatted.replace(/-/g, MINUS);
}

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
