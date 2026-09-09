import { Figure, Label } from "@/components/primitives";
import type { FleetSeries, FleetSummary } from "@/lib/fleet";
import { ChartLegend } from "./chart-legend";
import { FleetChart } from "./fleet-chart";

/**
 * Platform return, above the executor list.
 *
 * Two numbers that answer different questions, each with a one-clause
 * explanation in lowercase (§7). Capital-weighted takes the result colors
 * because it is the result; equal-weighted takes its own series color, which
 * is what ties the figure to the dashed line below it.
 */
export function ReturnsPanel({
  summary,
  series,
}: {
  summary: FleetSummary;
  series: FleetSeries;
}) {
  return (
    <div className="border-hair border-b pt-4 pb-[14px]">
      <div className="mb-[10px] flex items-start justify-between">
        <div className="flex gap-7">
          <div>
            <Label>capital-weighted</Label>
            <Figure
              value={summary.capitalWeightedReturn}
              tone="direction"
              size="lg"
              format="percent"
              signed
              className="mt-1.5 block"
            />
            <div className="text-body text-muted">what the book actually earned</div>
          </div>
          <div>
            <Label>equal-weighted</Label>
            <Figure
              value={summary.equalWeightedReturn}
              size="lg"
              format="percent"
              signed
              className="mt-1.5 block text-[var(--chart-ew)]"
            />
            <div className="text-body text-muted">how the average strategy behaved</div>
          </div>
        </div>
        <ChartLegend />
      </div>

      <FleetChart series={series} />

      <div className="text-note text-muted mt-2 flex justify-between">
        <span>{series.provenance}</span>
        <span>0% reference</span>
      </div>
    </div>
  );
}
