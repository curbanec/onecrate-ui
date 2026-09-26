import { Figure, Label, Note, StatusDot } from "@/components/primitives";
import type { CarriedMarks } from "@/lib/fleet";

/**
 * Three freshness facts, no verdicts (§6.4).
 *
 * DATA THROUGH is the latest market day any live executor has a snapshot for. It names
 * a day rather than a moment, which is why it is not "as of": `snapshot_date` is a DATE
 * column and carries no clock time. It is also a max across the live executors, so one
 * executor lagging behind the others does not show up in it.
 *
 * RECONCILED AS OF is when the books last
 * actually agreed to a settled answer — a freshness fact, not a judgement:
 * whether they disagree lives in the drift banner (§6.5), and there is
 * deliberately no all-clear tint here. A permanently green strip is how the one
 * amber morning gets skipped.
 *
 * STALE PRICES is named for what the operator sees rather than for the
 * `mark_source` column behind it — "carried mark" is platform vocabulary, and the
 * glossary rules `mark` out as a UI term.
 */
export function FreshnessStrip({
  dataThrough,
  reconciledAsOf,
  carried,
  stale,
}: {
  dataThrough: string | null;
  reconciledAsOf: string | null;
  carried: CarriedMarks;
  stale?: boolean;
}) {
  const isStale = stale ?? dataThrough === null;

  return (
    <div className="bg-raised border-hair rounded-control flex flex-wrap items-baseline gap-x-[26px] gap-y-2 self-start border px-[14px] py-[10px]">
      <div>
        <Label>data through</Label>
        <div className="mt-1.5 flex items-baseline gap-2">
          {isStale && <StatusDot status="stale" className="self-center" />}
          {dataThrough === null ? (
            <>
              <Figure value={null} />
              <Note>timestamp not supplied</Note>
            </>
          ) : (
            <span className="font-numeric text-data tabular-nums">{dataThrough}</span>
          )}
        </div>
      </div>

      <div>
        <Label>reconciled as of</Label>
        <div className="mt-1.5 flex items-baseline gap-2">
          {reconciledAsOf === null ? (
            <>
              <Figure value={null} />
              <Note>no day has settled</Note>
            </>
          ) : (
            <span className="font-numeric text-data tabular-nums">
              {reconciledAsOf}
            </span>
          )}
        </div>
      </div>

      <div>
        <Label>stale prices</Label>
        <div className="mt-1.5 flex items-baseline gap-2">
          <Figure value={carried.count} />
          {carried.titles.length > 0 && <Note>{carried.titles.join(" · ")}</Note>}
        </div>
      </div>
    </div>
  );
}
