import { cn } from "@/lib/utils";

/**
 * A structural placeholder awaiting a real endpoint (§6.7).
 *
 * Hatched rather than blank, and always labeled with what belongs there, so a
 * region with no data yet can never be mistaken for a region whose data is
 * legitimately empty.
 */
export function HatchedSlot({
  children,
  variant = "inline",
  className,
}: {
  children: React.ReactNode;
  /** `inline` sits in the row spine; `block` fills an expanded-card cell. */
  variant?: "inline" | "block";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-control border-hair text-note text-muted border",
        variant === "inline"
          ? "flex h-7 items-center px-[9px]"
          : "h-[70px] items-start p-2",
        className,
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, var(--accent-surface) 0 5px, transparent 5px 11px)",
      }}
    >
      {children}
    </div>
  );
}
