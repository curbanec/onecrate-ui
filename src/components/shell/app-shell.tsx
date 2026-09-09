import type { CrossConfig } from "@/lib/design";
import type { NavItem } from "@/lib/fleet";
import { Rail } from "./rail";

/**
 * The page shell (§5.1): rail plus content, framed as one panel on the `desk`
 * surface.
 */
export function AppShell({
  active,
  crossConfig,
  children,
}: {
  active: NavItem;
  crossConfig?: Partial<CrossConfig>;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-desk min-h-full p-16">
      <div className="bg-panel text-ink border-frame rounded-card flex min-h-[780px] overflow-hidden border">
        <Rail active={active} crossConfig={crossConfig} />
        <div className="min-w-0 flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}
