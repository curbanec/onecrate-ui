import type { CrossConfig } from "@/lib/design";
import type { NavItem } from "@/lib/fleet";
import type { DeploymentEnv } from "@/lib/data";
import { Rail } from "./rail";

export function AppShell({
  active,
  env,
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
  crossConfig?: Partial<CrossConfig>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-desk min-h-full p-16">
      <div className="bg-panel text-ink border-frame rounded-card flex min-h-[780px] overflow-hidden border">
        <Rail active={active} env={env} crossConfig={crossConfig} />
        <div className="min-w-0 flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}
