import { RAIL_WIDTH, type CrossConfig } from "@/lib/design";
import type { NavItem } from "@/lib/fleet";
import { EnvToggle } from "./env-toggle";
import { HairlineCross } from "./hairline-cross";
import { RailNav } from "./rail-nav";

/** Rail padding, px. The cross bleeds past it to reach the rail edges. */
const RAIL_PADDING = 16;

/** Left nav rail (§5.1) — `rail` surface, one step deeper than `panel`. */
export function Rail({
  active,
  crossConfig,
}: {
  active: NavItem;
  crossConfig?: Partial<CrossConfig>;
}) {
  return (
    <div
      className="bg-rail border-hair flex flex-none flex-col border-r"
      style={{ width: RAIL_WIDTH }}
    >
      <div
        className="border-hair relative border-b"
        style={{ padding: RAIL_PADDING }}
      >
        <HairlineCross config={crossConfig} bleed={RAIL_PADDING} />
        <EnvToggle className="mt-[15px]" />
      </div>
      <RailNav active={active} />
    </div>
  );
}
