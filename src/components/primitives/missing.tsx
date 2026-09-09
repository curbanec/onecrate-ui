import { cn } from "@/lib/utils";

/**
 * A value with no source (§6.7).
 *
 * Never a zero, a placeholder number, or an estimate — those all assert
 * something the data does not support. Structural placeholders awaiting a real
 * endpoint use <HatchedSlot> instead.
 */
export function Missing({ className }: { className?: string }) {
  return (
    <span className={cn("font-numeric text-flat", className)}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">not supplied</span>
    </span>
  );
}
