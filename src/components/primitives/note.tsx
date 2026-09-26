import { cn } from "@/lib/utils";

export function Note({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("text-note text-muted", className)}>{children}</div>;
}
