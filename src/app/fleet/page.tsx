import {verifySession} from "@/lib/dal";
import {AppShell} from "@/components/shell";
import {DriftBanner, ExecutorTable, HeaderBand, ReturnsPanel} from "@/components/fleet";
import {executors, series, summary} from "@/lib/fleet";

export default async function FleetPage() {
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
