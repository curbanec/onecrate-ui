import { RAIL_WIDTH, type CrossConfig } from "@/lib/design";
import { navHref, type FleetScope, type NavItem } from "@/lib/fleet";
import type { DeploymentEnv } from "@/lib/data";
import { EnvToggle } from "./env-toggle";
import { HairlineCross } from "./hairline-cross";
import { RailNav } from "./rail-nav";
import { ScopeToggle } from "./scope-toggle";

const RAIL_PADDING = 16;

export function Rail({
  active,
  env,
  scope,
  crossConfig,
}: {
  active: NavItem;
  /** Environment currently being viewed — drives the toggle's state and links. */
  env: DeploymentEnv;
  /** Population currently being viewed, carried across a PROD/DEV switch. */
  scope?: FleetScope;
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
        {/* Both toggles stay on the current route and rewrite only their own
            param, carrying the other through — so switching environment does not
            reset the population, and switching population does not move you
            between live and paper. */}
        <EnvToggle
          env={env}
          scope={scope}
          basePath={navHref(active)}
          className="mt-[15px]"
        />
        {scope !== undefined && (
          <ScopeToggle
            scope={scope}
            env={env}
            basePath={navHref(active)}
            className="mt-1.5"
          />
        )}
      </div>
      <RailNav active={active} />
    </div>
  );
}
