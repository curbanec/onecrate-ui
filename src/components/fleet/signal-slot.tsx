import { HatchedSlot } from "@/components/primitives";
import type { Executor } from "@/lib/fleet";
import { DailyMarks } from "./daily-marks";

/**
 * The one region that varies by strategy character (§6.2).
 *
 * Falls back to the hatched placeholder when there is nothing to plot. That is
 * the honest state for a newly deployed executor: a placeholder says "this
 * belongs here and has no data yet", where an empty box says nothing at all.
 */
export function SignalSlot({ executor }: { executor: Executor }) {
  /**
   * A retired executor has daily marks in SQL, but what the slot is ALLOWED to
   * draw depends on strategy character, and character comes from the manifest's
   * `execution.dataRequirements.timeframe` — overwritten on every deploy. Without
   * it there is no way to know whether discrete marks or an equity line would be
   * the honest treatment, so the slot says what is missing instead of guessing.
   */
  if (executor.kind === "retired") {
    return <HatchedSlot>strategy character not recorded at retirement</HatchedSlot>;
  }

  if (executor.marks.length === 0) {
    return <HatchedSlot>{executor.signalNote}</HatchedSlot>;
  }

  return (
    <div className="flex items-center gap-2">
      <DailyMarks
        marks={executor.marks}
        label={`Daily cumulative P&L marks for ${executor.title}`}
      />
      <span className="text-note text-muted whitespace-nowrap">
        {executor.signalNote}
      </span>
    </div>
  );
}
