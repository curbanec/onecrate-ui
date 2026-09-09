import { Figure, Label, Note, StatusDot } from "@/components/primitives";
import type { CarriedMarks } from "@/lib/fleet";

/**
 * The freshness strip (§6.4) — a small raised instrument block reporting only
 * facts the data actually supports.
 *
 * Note what is absent: no reconciliation readout. Drift is a banner (§6.5),
 * and putting a quiet "all reconciled" line here would undercut it.
 */
export function FreshnessStrip({
  asOf,
  carried,
  stale,
}: {
  asOf: string | null
  carried: CarriedMarks;
  /**
   * Data has not updated when it should have. Defaults to "no timestamp at
   * all", which is at least as untrustworthy as an old one. A real staleness
   * window needs an expected-update interval the data does not yet carry.
   */
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
