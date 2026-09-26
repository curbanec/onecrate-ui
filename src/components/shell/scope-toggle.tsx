import Link from "next/link";

import { cn } from "@/lib/utils";
import type { DeploymentEnv } from "@/lib/data";
import {
  FLEET_SCOPES,
  FLEET_SCOPE_LABELS,
  FLEET_SCOPE_TITLES,
  fleetHref,
  type FleetScope,
} from "@/lib/fleet";

/**
 * Current / SI population switch.
 *
 * Selects which executors every figure on the page describes: those in the
 * deployment manifest right now, or every executor that ever reported. It scopes
 * the whole page rather than the chart alone — a curve that changes population
 * while the figures beside it do not would report two populations in one header
 * band.
 *
 * Built like `EnvToggle`, and for the same reasons: plain links through
 * `fleetHref`, so the URL is the source of truth and this stays a Server
 * Component with no hydration. The environment rides along, so switching
 * population cannot silently move you between live and paper data.
 *
 * Sits directly under the env toggle in the rail, and under it again in the
 * narrow bar. Only Fleet has a population, so the rail renders this only when a
 * scope is passed — the other routes get the rail without it.
 *
 * The active segment carries the same solid `accent` as the env toggle's PROD,
 * so the two controls read as one family rather than as a control and a lesser
 * control.
 *
 * ITD is inception to date. Each segment carries the expansion as a title,
 * because a three-letter abbreviation is opaque on first read and the visible
 * label has to stay short enough to sit beside CURRENT in a 156px rail.
 */
export function ScopeToggle({
  scope,
  env,
  basePath,
  className,
}: {
  /** Population currently being viewed. */
  scope: FleetScope;
  /** Environment currently being viewed, carried across the switch. */
  env: DeploymentEnv;
  /** Route the toggle stays on, e.g. `/fleet`. */
  basePath: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Population"
      className={cn(
        "border-hair rounded-control flex overflow-hidden border",
        className,
      )}
    >
      {FLEET_SCOPES.map((target) => (
        <Link
          key={target}
          href={fleetHref(basePath, { env, scope: target })}
          aria-current={scope === target ? "page" : undefined}
          title={FLEET_SCOPE_TITLES[target]}
          className={cn(
            // flex-1 is what makes each segment fill its half of the container.
            // Without it they size to their text, so a three-character ITD fill
            // would cover a sliver while CURRENT covered most of the row.
            //
            // text-center and no-underline do real work: an anchor centers
            // nothing and underlines by default, a button does the opposite.
            "text-label flex-1 py-1.5 text-center uppercase no-underline",
            scope === target
              ? "bg-accent text-white"
              : "bg-transparent text-muted",
          )}
        >
          {FLEET_SCOPE_LABELS[target]}
        </Link>
      ))}
    </div>
  );
}
