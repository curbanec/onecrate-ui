import { cn } from "@/lib/utils";

/**
 * §2.5. Open/idle/halted reuse gain/flat/loss rather than introducing new
 * colors; `stale` is the one amber in the system, which is what makes it read
 * as a warning.
 */
export type Status = "open" | "idle" | "halted" | "stale";

const TONES: Record<Status, string> = {
  open: "bg-state-open",
  idle: "bg-state-idle",
  halted: "bg-state-halted",
  stale: "bg-state-stale",
};

const LABELS: Record<Status, string> = {
  open: "holding a position",
  idle: "running, flat",
  halted: "halted",
  stale: "data is stale",
};

export function StatusDot({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-[7px] shrink-0 rounded-full",
        TONES[status],
        className,
      )}
    >
      <span className="sr-only">{LABELS[status]}</span>
    </span>
  );
}
