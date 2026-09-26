import { HatchedSlot } from "@/components/primitives";
import type { Executor, Mark, StrategyCharacter } from "@/lib/fleet";
import { DailyMarks, EquityLine } from "./daily-marks";

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
            <CharacterPlot
                character={executor.character}
                marks={executor.marks}
                label={`Daily cumulative P&L marks for ${executor.title}`}
            />
            <span className="text-note text-muted whitespace-nowrap">
        {executor.signalNote}
      </span>
        </div>
    );
}

/**
 * §6.2's mapping, and the only place it is expressed.
 *
 * `continuous` holds positions across days, so a connected path does not claim
 * movement that did not happen — the position was live through the gap.
 *
 * `intraday` is flat on roughly four days in five. A line through those days
 * would invent a trajectory, so each day stays its own discrete mark.
 *
 * `pairs` is specified to show current spread state, which no current data
 * source provides. It falls back to discrete marks rather than a hatched slot
 * because the marks are real cumulative P&L — accurate, just not the
 * specialised treatment. Revisit when spread state is available.
 */
function CharacterPlot({
                           character,
                           marks,
                           label,
                       }: {
    character: StrategyCharacter;
    marks: Mark[];
    label: string;
}) {
    switch (character) {
        case "continuous":
            return <EquityLine marks={marks} label={label} />;
        case "intraday":
        case "pairs":
            return <DailyMarks marks={marks} label={label} />;
    }
}