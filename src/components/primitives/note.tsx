import { cn } from "@/lib/utils";
import { sampleNote } from "@/lib/fleet";

export function Note({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("text-note text-muted", className)}>{children}</div>;
}

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
