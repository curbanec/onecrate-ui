import { cn } from "@/lib/utils";

export function HatchedSlot({
  children,
  variant = "inline",
  className,
}: {
  children: React.ReactNode;
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
