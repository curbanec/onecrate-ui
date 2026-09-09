import { HatchedSlot } from "@/components/primitives";
import type { Executor } from "@/lib/fleet";

export function SignalSlot({ executor }: { executor: Executor }) {
  return <HatchedSlot>{executor.signalNote}</HatchedSlot>;
}
