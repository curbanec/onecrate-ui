import { crossGeometry, type CrossConfig } from "@/lib/design";
import type { FleetSummary } from "@/lib/fleet";
import { FreshnessStrip } from "./freshness-strip";
import { PlatformTotals } from "./platform-totals";

export function HeaderBand({
  title,
  summary,
  crossConfig,
}: {
  title: string;
  summary: FleetSummary;
  crossConfig?: Partial<CrossConfig>;
}) {
  const { headerBandHeight } = crossGeometry(crossConfig);

  return (
    <div
      className="border-hair box-border flex items-stretch justify-between border-b pb-1"
      style={{ height: headerBandHeight }}
    >
      <div className="flex flex-col justify-between">
        <FreshnessStrip asOf={summary.asOf} carried={summary.carried} />
        <h1 className="text-heading m-0">{title}</h1>
      </div>
      <PlatformTotals summary={summary} />
    </div>
  );
}
