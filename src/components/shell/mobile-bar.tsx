import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, navHref, type NavItem } from "@/lib/fleet";
import type { DeploymentEnv } from "@/lib/data";
import { EnvToggle } from "./env-toggle";

const CUBE_TOP = "#8E76D6";

/**
 * Narrow-screen stand-in for the rail (§5.1).
 *
 * The rail is 188px of a 375px screen, so below `lg` it collapses into this
 * bar. The hairline cross does not come along: it exists to line up with the
 * header band, and the narrow layout has no header band to line up with.
 *
 * The env toggle does come along. Paper figures mistaken for live ones is the
 * failure the toggle exists to design out, and that matters more on a phone,
 * not less.
 */
export function MobileBar({
  active,
  env,
}: {
  active: NavItem;
  env: DeploymentEnv;
}) {
  return (
    <div className="bg-rail border-hair border-b lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <svg width={18} height={21} viewBox="0 0 26 30" aria-hidden="true" className="block">
            <polygon points="0,7.5 13,15 13,30 0,22.5" fill="var(--accent)" />
            <polygon points="13,0 26,7.5 13,15 0,7.5" fill={CUBE_TOP} />
            <polygon points="26,7.5 26,22.5 13,30 13,15" fill="var(--accent-ink)" />
          </svg>
          <span className="text-[18px] leading-none font-semibold tracking-[-0.02em]">
            OneCrate
          </span>
        </div>
        <EnvToggle env={env} basePath={navHref(active)} className="w-[112px]" />
      </div>

      <nav className="flex gap-0.5 overflow-x-auto px-2 pb-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item}
            href={navHref(item)}
            aria-current={item === active ? "page" : undefined}
            className={cn(
              "rounded-control text-note px-[10px] py-1.5 leading-[1.2] font-medium whitespace-nowrap no-underline",
              item === active ? "bg-accent-surface text-accent-ink" : "text-muted",
            )}
          >
            {item}
          </Link>
        ))}
      </nav>
    </div>
  );
}
