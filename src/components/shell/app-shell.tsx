import type { CrossConfig } from "@/lib/design";
import type { FleetScope, NavItem } from "@/lib/fleet";
import type { DeploymentEnv } from "@/lib/data";
import { MobileBar } from "./mobile-bar";
import { Rail } from "./rail";

export function AppShell({
  active,
  env,
  scope,
  crossConfig,
  children,
}: {
  active: NavItem;
  /**
   * Environment currently being viewed. Required rather than defaulted: a
   * default here would silently decide which dataset the rail claims to show,
   * and the page reading `?env=` is the only thing that actually knows.
   */
  env: DeploymentEnv;
  /**
   * Population currently being viewed, threaded through so the env toggle can
   * carry it across a PROD/DEV switch. Optional because only Fleet has a scope;
   * a route without one omits it and the toggle emits no `?scope=`.
   */
  scope?: FleetScope;
  crossConfig?: Partial<CrossConfig>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-desk flex min-h-full flex-1 flex-col lg:block lg:p-16">
      {/* Below lg the desk margin and panel frame go: on a phone they are
          just 64px of padding around a 375px screen. */}
      <div className="bg-panel text-ink border-frame flex flex-1 flex-col overflow-hidden lg:min-h-[780px] lg:flex-row lg:rounded-card lg:border">
        <MobileBar active={active} env={env} scope={scope} />
        <Rail active={active} env={env} scope={scope} crossConfig={crossConfig} />
        <div className="min-w-0 flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}
