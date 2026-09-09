import { cn } from "@/lib/utils";
import { sampleNote } from "@/lib/fleet";

/** Row subtitle or inline annotation (§3.1). */
export function Note({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("text-note text-muted", className)}>{children}</div>;
}

/**
 * Sample size, which sits adjacent to every derived statistic (§6.1).
 *
 * A statistic derived from 6 trades must not look as authoritative as one from
 * 200, and the count is how the reader tells them apart.
 */
export function SampleNote({
  sampleSize,
  className,
}: {
  sampleSize: number;
  className?: string;
}) {
  return (
    <div className={cn("text-data-sm font-numeric text-flat", className)}>
      {sampleNote(sampleSize)}
    </div>
  );
}
