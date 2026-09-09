import { Figure, Label, Note, StatusDot } from "@/components/primitives";
import type { CarriedMarks } from "@/lib/fleet";

export function FreshnessStrip({
  asOf,
  carried,
  stale,
}: {
  asOf: string | null
  carried: CarriedMarks;
  stale?: boolean;
}) {
  const isStale = stale ?? asOf === null;

  return (
    <div className="bg-raised border-hair rounded-control flex items-baseline gap-[26px] self-start border px-[14px] py-[10px]">
      <div>
        <Label>as of</Label>
        <div className="mt-1.5 flex items-baseline gap-2">
          {isStale && <StatusDot status="stale" className="self-center" />}
          {asOf === null ? (
            <>
              <Figure value={null} />
              <Note>timestamp not supplied</Note>
            </>
          ) : (
            <span className="font-numeric text-data tabular-nums">{asOf}</span>
          )}
        </div>
      </div>

      <div>
        <Label>carried marks</Label>
        <div className="mt-1.5 flex items-baseline gap-2">
          <Figure value={carried.count} />
          {carried.titles.length > 0 && <Note>{carried.titles.join(" · ")}</Note>}
        </div>
      </div>
    </div>
  );
}
