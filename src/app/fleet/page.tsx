import { verifySession } from "@/lib/dal";
import { AppShell } from "@/components/shell";
import {
  DriftBanner,
  ExecutorTable,
  HaltNotice,
  HeaderBand,
  ManifestNotice,
  ReturnsPanel,
} from "@/components/fleet";
import { parseDeploymentEnv } from "@/lib/data";
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
     * Five independent reads, issued together. They share no inputs — the
     * manifest comes from blob storage and the rest from SQL — so serializing
     * them would just add their latencies together.
     *
     * Each function performs its own session check; `verifySession()` is
     * memoized per render pass, so that costs one lookup rather than six.
     */
    const [current, daily, platform, closedTrades, drift] = await Promise.all([
        getCurrentState(env),
        getDailyPerformance(env),
        getPlatformPerformance(env),
        getTrades(env, { status: "closed" }),
        getDrift(env),
    ]);

    const { executors, summary, series } = buildFleetView({
        current,
        daily,
        platform,
        closedTrades,
        drift,
    });

    return (
        <AppShell active="Fleet" env={env}>
            <AutoRefresh />
            <ManifestNotice status={current.manifestStatus} error={current.manifestError} />
            <HaltNotice halt={current.halt} />
            <DriftBanner drift={summary.drift} />
            <HeaderBand title="Fleet" summary={summary} />
            <ReturnsPanel summary={summary} series={series} />
            <ExecutorTable executors={executors} />
        </AppShell>
    );
}
