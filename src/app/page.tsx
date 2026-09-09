import { Suspense } from "react";
import type { Metadata } from "next";

import { HairlineCross } from "@/components/shell/hairline-cross";
import { Label } from "@/components/primitives";
import { NavSession, NavSessionFallback } from "./nav-session";

export const metadata: Metadata = {
  title: "OneCrate",
  description: "Operator console for algorithmic trading executors.",
};

/**
 * Splash.
 *
 * Deliberately not a marketing landing page: no KPI row, no gradient area
 * chart, no claimed figures (§8). Nothing here is a number, because there is no
 * data source behind a splash and an invented one would be a lie (§6.7). What it
 * shows is the mark, what the thing is, and the way in.
 */
export default function Page() {
  return (
    <main className="flex min-h-full flex-col p-4">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <header className="flex items-start justify-between">
          {/* The signature alignment mark (§5.2), reused as the splash's anchor. */}
          <div className="w-[188px]">
            <HairlineCross bleed={0} />
          </div>
          <Suspense fallback={<NavSessionFallback />}>
            <NavSession />
          </Suspense>
        </header>

        <div className="mt-16 flex-1">
          <h1 className="text-heading text-ink">
            One question per screen.
          </h1>
          <p className="text-body text-muted mt-3 max-w-[52ch]">
            OneCrate is the operator console for a fleet of algorithmic trading
            executors. Every screen answers one thing: should this executor get
            more capital, less, or none.
          </p>

          <div className="border-hair mt-10 border-t pt-6">
            <Label>What it does</Label>
            <ul className="text-body text-ink mt-3 flex flex-col gap-2">
              <li>
                <span className="text-muted">evidence quality is visible</span> ·
                a statistic drawn from six trades does not look as authoritative
                as one drawn from two hundred
              </li>
              <li>
                <span className="text-muted">sparse data is the steady state</span> ·
                an intraday strategy is flat most days, and the display says so
                rather than smoothing it away
              </li>
              <li>
                <span className="text-muted">no invented content</span> ·
                a figure with no source renders as an em dash, never as a
                plausible-looking number
              </li>
            </ul>
          </div>
        </div>

        <footer className="border-hair text-note text-muted mt-16 border-t pt-4">
          onecrate.io
        </footer>
      </div>
    </main>
  );
}
