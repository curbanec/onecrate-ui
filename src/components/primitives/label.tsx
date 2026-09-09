import { cn } from "@/lib/utils";

/** Column header or field label — uppercase, letterspaced, muted (§3.1, §7). */
export function Label({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-label text-muted uppercase", className)}>{children}</div>
  );
}
