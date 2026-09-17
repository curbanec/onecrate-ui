"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-fetch the page periodically while the tab is visible.
 *
 * `router.refresh()` re-runs the Server Component render — the same code path as
 * a navigation — so the new data comes from the same query functions with the
 * same session check. It touches no broker: nothing in this application calls
 * Alpaca, and refreshing reads the database and the deployment manifest only.
 *
 * Gated on visibility because a background tab polling a live trading database
 * every minute is pure cost. Refreshing once on becoming visible again also
 * means returning to the tab shows current figures rather than whatever was on
 * screen when it was hidden — which, on a page about live money, is the part
 * that actually matters.
 *
 * Renders nothing.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      stop();
      timer = setInterval(() => router.refresh(), intervalMs);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);

  return null;
}
