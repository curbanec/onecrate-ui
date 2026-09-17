import Link from "next/link";

import { cn } from "@/lib/utils";
import { DEPLOYMENT_ENVS, type DeploymentEnv } from "@/lib/data";

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
 * Known limitation: toggling rebuilds the query string from scratch, so any
 * other search param on the route is dropped. Nothing sets one today. When
 * something does (a Trades filter, say), this needs the full current query
 * passed in rather than just the base path.
 */
export function EnvToggle({
  env,
  basePath,
  className,
}: {
  /** Environment currently being viewed. */
  env: DeploymentEnv;
  /** Route the toggle stays on, e.g. `/fleet`. */
  basePath: string;
  className?: string;
}) {
  const tone = (target: DeploymentEnv) => {
    if (env !== target) return "bg-transparent text-muted";
    return target === "prod"
      ? "bg-accent text-white"
      : "bg-accent-surface text-accent-ink";
  };

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
          href={`${basePath}?env=${target}`}
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
