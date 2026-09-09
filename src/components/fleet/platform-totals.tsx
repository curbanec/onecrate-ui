import { Figure, Label } from "@/components/primitives";
import type { FleetSummary } from "@/lib/fleet";

/**
 * Platform totals, bottom-right of the header band (§5.3).
 *
 * Bottom-aligned rather than boxed: four numbers on a baseline, not four KPI
 * cards. §8 rules the card row out — it is subject-agnostic, which is exactly
 * the problem.
 */
export function PlatformTotals({ summary }: { summary: FleetSummary }) {
  return (
    <div className="flex items-end gap-[30px]">
      <div>
        <Label>executors</Label>
        <Figure value={summary.executorCount} size="lg" className="mt-[5px] block" />
      </div>
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
