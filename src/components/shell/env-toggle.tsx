import Link from "next/link";

import { cn } from "@/lib/utils";
import { DEPLOYMENT_ENVS, type DeploymentEnv } from "@/lib/data";
import { fleetHref, type FleetScope } from "@/lib/fleet";

/**
 * PROD / DEV toggle (§5.1).
 *
 * Selects which trading environment you are *looking at*, not which deployment
 * you are running. There is one deployment, to production; both datasets live
 * in the same database, separated by a column.
 *
 * The URL is the source of truth. This used to hold `useState`, which meant the
 * server could not know which environment to query and a screenshot could not
 * record which one you were looking at. Now each side is a plain link to the
 * same route with `?env=` set, and the page reads it back through
 * `parseDeploymentEnv`.
 *
 * That also makes this a Server Component: no `use client`, no hydration, no
 * Suspense boundary. The alternative — `useSearchParams` in a client component —
 * would force client-side rendering up to the nearest boundary, which Next's own
 * docs recommend avoiding when the value can be passed down instead.
 *
 * The Fleet scope rides along. Switching PROD→DEV must not silently reset which
 * population the page is showing, so both params are rebuilt together through
 * `fleetHref` — the one place a Fleet query string is assembled. A third param
 * means extending that function, not adding a second builder here.
 */
export function EnvToggle({
  env,
  scope,
  basePath,
  className,
}: {
  /** Environment currently being viewed. */
  env: DeploymentEnv;
  /** Population currently being viewed, carried across the switch. */
  scope?: FleetScope;
  /** Route the toggle stays on, e.g. `/fleet`. */
  basePath: string;
  className?: string;
}) {
  /**
   * Active is the solid accent in both directions — PROD and DEV look identical
   * on purpose, matching the scope toggle below so the rail's controls read as
   * one family. DEV used to carry the paler `accent-surface` to mark paper data;
   * the label now carries that distinction on its own.
   */
  const tone = (target: DeploymentEnv) =>
    env === target ? "bg-accent text-white" : "bg-transparent text-muted";

  return (
    <div
      role="group"
      aria-label="Environment"
      className={cn(
        "border-hair rounded-control flex overflow-hidden border",
        className,
      )}
    >
      {DEPLOYMENT_ENVS.map((target) => (
        <Link
          key={target}
          href={fleetHref(basePath, { env: target, scope })}
          aria-current={env === target ? "page" : undefined}
          className={cn(
            // text-center and no-underline are doing real work here: a button
            // centers its label and carries no underline by default, an anchor
            // does neither.
            "text-label flex-1 py-1.5 text-center uppercase no-underline",
            tone(target),
          )}
        >
          {target}
        </Link>
      ))}
    </div>
  );
}
