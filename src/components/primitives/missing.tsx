import { cn } from "@/lib/utils";

export function Missing({ className }: { className?: string }) {
  return (
    <span className={cn("font-numeric text-flat", className)}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">not supplied</span>
    </span>
  );
}
