import { verifySession } from "@/lib/dal";
import { AppShell } from "@/components/shell";
import {
  DriftBanner,
  ExecutorTable,
  HaltNotice,
  HeaderBand,
  ManifestNotice,
  MobileHeader,
  ReturnsPanel,
} from "@/components/fleet";
import { parseDeploymentEnv } from "@/lib/data";
import { parseFleetScope } from "@/lib/fleet";
import { getCurrentState } from "@/lib/data/current-state";
import {
  getDailyPerformance,
  getDrift,
  getPlatformPerformance,
  getTrades,
} from "@/lib/data/queries";
import { buildFleetView } from "@/lib/fleet-view";
import { AutoRefresh } from "./auto-refresh";

export default async function FleetPage({ searchParams }: PageProps<"/fleet">) {
    await verifySession();

    /**
     * Which trading environment to show, from `?env=`.
     *
     * A search param rather than a cookie so the environment is visible in the
     * URL: a screenshot or a shared link then records which dataset it shows.
     * Paper figures mistaken for live ones is the failure worth designing out.
     *
     * `searchParams` is a promise in this version, and a repeated key arrives as
     * an array — same handling as `login/page.tsx`. Anything unrecognised falls
     * back to prod rather than throwing; a mistyped URL should show live data,
     * not a 500.
     *
     * Reading it also makes this route dynamic, which is what we want: every
     * figure here is live, and a cached Fleet page would be a lie with a
     * timestamp on it.
     */
    const params = await searchParams;
    const requested = Array.isArray(params.env) ? params.env[0] : params.env;
    const env = parseDeploymentEnv(requested);

    /**
     * Which population every figure describes, from `?scope=`.
     *
     * `current` — the executors in the deployment manifest right now.
     * `si`      — every executor that ever reported in this environment.
     *
     * In the URL for the same reason as `env`: `current` is biased upward by
     * construction, because retired executors are disproportionately the ones
     * that were not working. A shared link or a screenshot has to record which
     * of the two readings it shows.
     *
     * Defaults to `current`, and anything unrecognised falls back there too.
     */
    const requestedScope = Array.isArray(params.scope) ? params.scope[0] : params.scope;
    const scope = parseFleetScope(requestedScope);

    /**
     * Five independent reads, issued together. They share no inputs — the
     * manifest comes from blob storage and the rest from SQL — so serializing
     * them would just add their latencies together.
     *
     * Each function performs its own session check; `verifySession()` is
     * memoized per render pass, so that costs one lookup rather than six.
     */
    const [current, daily, closedTrades, drift] = await Promise.all([
        getCurrentState(env),
        getDailyPerformance(env),
        getTrades(env, { status: "closed" }),
        getDrift(env),
    ]);

    /**
     * The platform aggregate for the population in scope. One query, not two:
     * only the active scope is ever rendered.
     *
     * It cannot join the batch above because the Current variant needs the
     * manifest triples that `getCurrentState` returns, and that call is itself in
     * the batch. So the blob read stays parallel with the SQL reads and this one
     * indexed GROUP BY runs after them.
     *
     * An empty manifest is skipped rather than queried: `getPlatformPerformance`
     * rejects an empty `triples` array by design, because filtering to nothing
     * and aggregating over everything must not be the same request. Nothing is
     * deployed, so the Current curve is genuinely empty — and `ManifestNotice`
     * already says so in its own banner.
     */
    const triples = current.executors.map((executor) => executor.triple);
    const platform =
        scope === "si"
            ? await getPlatformPerformance(env)
            : triples.length === 0
              ? []
              : await getPlatformPerformance(env, { triples });

    const { executors, summary, series } = buildFleetView({
        current,
        daily,
        platform,
        closedTrades,
        drift,
        scope,
    });

    return (
        <AppShell active="Fleet" env={env} scope={scope}>
            <AutoRefresh />
            <ManifestNotice status={current.manifestStatus} error={current.manifestError} />
            <HaltNotice halt={current.halt} />
            <DriftBanner drift={summary.drift} />
            <MobileHeader title="Fleet" summary={summary} />
            {/* Desktop only: the chart is too much for a phone, and the band
                aligns to a hairline cross the narrow layout does not draw. */}
            <div className="hidden lg:block">
                <HeaderBand title="Fleet" summary={summary} />
                <ReturnsPanel summary={summary} series={series} />
            </div>
            <ExecutorTable executors={executors} />
        </AppShell>
    );
}
