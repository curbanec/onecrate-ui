import { HatchedSlot } from "@/components/primitives";
import type { Executor } from "@/lib/fleet";

/**
 * The one region of a card that varies by strategy character (§6.2).
 *
 * No series data exists behind this yet, so every character renders the
 * hatched placeholder naming what belongs there — which is §6.7's rule for a
 * region awaiting a real endpoint, and is honest in a way an empty box or a
 * fake sparkline would not be.
 *
 * When the series arrive, this is where they branch, and the branch matters:
 *
 *   intraday   discrete daily marks, NOT a sparkline. Roughly four days in
 *              five are flat, and a smooth line lies about that.
 *   continuous a real equity line.
 *   pairs      current spread state.
 */
export function SignalSlot({ executor }: { executor: Executor }) {
  return <HatchedSlot>{executor.signalNote}</HatchedSlot>;
}
