import type { FleetSummary } from "@/lib/fleet";
import { FreshnessStrip } from "./freshness-strip";

/**
 * Narrow-screen header, in place of the header band and returns chart.
 *
 * The band's height is derived from the hairline cross, which is not drawn
 * below `lg`, so there is nothing for it to align to. The freshness strip
 * stays: a figure without its as-of time is one you cannot trust, and a phone
 * is where you are most likely to be looking at an old page.
 */
export function MobileHeader({
  title,
  summary,
}: {
  title: string;
  summary: FleetSummary;
}) {
  return (
    <div className="border-hair flex flex-col gap-3 border-b pb-3 lg:hidden">
      <h1 className="text-heading m-0">{title}</h1>
      <FreshnessStrip asOf={summary.asOf} carried={summary.carried} />
    </div>
  );
}
