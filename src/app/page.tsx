import { Suspense } from "react";
import type { Metadata } from "next";

import { HairlineCross } from "@/components/shell/hairline-cross";
import { Label } from "@/components/primitives";
import { NavSession, NavSessionFallback } from "./nav-session";

export const metadata: Metadata = {
  title: "OneCrate",
  description: "Operator console for algorithmic trading executors.",
};

export default function Page() {
  return (
    <main className="flex min-h-full flex-col p-4">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col">
        <header className="flex items-start justify-between">
          <div className="w-[188px]">
            <HairlineCross bleed={0} cubeVariant="grid" cubeSpin />
          </div>
          <Suspense fallback={<NavSessionFallback />}>
            <NavSession />
          </Suspense>
        </header>

        <div className="mt-16 flex-1">
          <h1 className="text-heading text-ink">
            One flexible, intelligently designed, reconcilable machine.
          </h1>
          <p className="text-body text-muted mt-3 max-w-[52ch]">
            OneCrate.io is a polyglot algorithmic trading platform where stateless strategy services
            receive market context and return trading decisions while maintaining complete
            observability into their actions.
          </p>

          <div className="border-hair mt-10 border-t pt-6">
            <Label>What it does</Label>
            <ul className="text-body text-ink mt-3 flex flex-col gap-2">
              <li>
                <span className="text-muted">layers on top of Alpaca</span> ·
                connect your alpaca brokerage accounts to enable OneCrate’s algorithmic trading capabilities
              </li>
              <li>
                <span className="text-muted">a growing variety of trading strategies</span> ·
                One highly configurable ‘Crate’ is deployed which is set up to trade over a contract with
                stateless strategy logic
              </li>
              <li>
                <span className="text-muted">complete observability and reconciliation</span> ·
                every think loop in the platform is traceable and every balance, figure, and statistic
                is accounted for and explainable
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
