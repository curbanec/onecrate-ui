import {verifySession} from "@/lib/dal";
import {AppShell} from "@/components/shell";
import {DriftBanner, ExecutorTable, HeaderBand, ReturnsPanel} from "@/components/fleet";
import {executors, series, summary} from "@/lib/fleet";

export default async function FleetPage() {
    /**
     * The authoritative check, next to the data rather than in a layout — a
     * layout cannot stop route segments from rendering or from appearing in the
     * RSC payload. Redirects to /login when there is no valid session.
     *
     * `orgId` is not used yet because there is one organization, but it is read
     * here so that the day a second one exists the scoping is already threaded
     * through rather than retrofitted across live trade tables.
     */
    await verifySession();

    return (
        <AppShell active="Fleet">
            <DriftBanner drift={summary.drift} />
            <HeaderBand title="Fleet" summary={summary} />
            <ReturnsPanel summary={summary} series={series} />
            <ExecutorTable executors={executors} />
        </AppShell>
    );
}