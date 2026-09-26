import { Figure, Label, Note } from "@/components/primitives";
import type { FleetSummary } from "@/lib/fleet";

export function PlatformTotals({ summary }: { summary: FleetSummary }) {
  return (
    <div className="flex items-end gap-[30px]">
      <div>
        <Label>executors</Label>
        <Figure value={summary.executorCount} size="lg" className="mt-[5px] block" />
        {/* In SI the count includes executors that no longer exist, and the
            retired cards are on screen below. Naming the split describes what is
            rendered instead of leaking a current-manifest fact into a
            since-inception header. */}
        {summary.scope === "si" && summary.retiredCount > 0 && (
          <Note className="mt-0.5">{summary.retiredCount} retired</Note>
        )}
      </div>
      {/* Omitted entirely in SI scope, not em-dashed. Summing live allocation
          with retired executors' final allocation mixes a current quantity with
          historical ones and produces a number that is not a quantity of
          anything — and an em dash would claim we do not know it, which is
          false. The type makes the figure unreachable outside Current. */}
      {summary.scope === "current" && (
        <div>
          <Label>allocated</Label>
          <Figure
            value={summary.allocated}
            size="lg"
            format="currency"
            precision={0}
            className="mt-[5px] block"
          />
        </div>
      )}
      <div>
        <Label>cumulative p&amp;l</Label>
        <Figure
          value={summary.cumulativePnl}
          tone="direction"
          size="lg"
          format="currency"
          signed
          className="mt-[5px] block"
        />
      </div>
      <div>
        <Label>closed trades</Label>
        <Figure value={summary.closedTrades} size="lg" className="mt-[5px] block" />
      </div>
    </div>
  );
}
