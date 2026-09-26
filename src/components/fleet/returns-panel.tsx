import { Figure, Label } from "@/components/primitives";
import type { FleetSeries, FleetSummary } from "@/lib/fleet";
import { ChartLegend } from "./chart-legend";
import { FleetChart } from "./fleet-chart";

/**
 * Platform returns for the population currently in scope.
 *
 * Both figures answer to the rail's Current/ITD switch — they are the same two
 * metrics recomputed over a different population, not two readings shown side by
 * side. Nothing on the panel names that population or its start date any more, so
 * the toggle's own label is the only thing attributing these figures.
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
      <div className="mb-[10px] flex items-start justify-between gap-4">
        <div className="flex flex-wrap gap-7">
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
    </div>
  );
}
