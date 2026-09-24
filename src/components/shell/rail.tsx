import { RAIL_WIDTH, type CrossConfig } from "@/lib/design";
import { navHref, type NavItem } from "@/lib/fleet";
import type { DeploymentEnv } from "@/lib/data";
import { EnvToggle } from "./env-toggle";
import { HairlineCross } from "./hairline-cross";
import { RailNav } from "./rail-nav";

const RAIL_PADDING = 16;

export function Rail({
  active,
  env,
  crossConfig,
}: {
  active: NavItem;
  /** Environment currently being viewed — drives the toggle's state and links. */
  env: DeploymentEnv;
  crossConfig?: Partial<CrossConfig>;
}) {
  return (
    <div
      className="bg-rail border-hair hidden flex-none flex-col border-r lg:flex"
      style={{ width: RAIL_WIDTH }}
    >
      <div
        className="border-hair relative border-b"
        style={{ padding: RAIL_PADDING }}
      >
        <HairlineCross config={crossConfig} bleed={RAIL_PADDING} />
        {/* The toggle stays on the current route and only rewrites ?env=. */}
        <EnvToggle env={env} basePath={navHref(active)} className="mt-[15px]" />
      </div>
      <RailNav active={active} />
    </div>
  );
}
