import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFleetView,
  flattenParameters,
  readTimeframe,
  winRateOf,
  type FleetViewInput,
} from "./fleet-view";
import type {
  CurrentExecutor,
  CurrentState,
  DailyPerformanceRow,
  DriftRow,
  PlatformPerformanceRow,
  TradeRow,
} from "./data";

/**
 * The prop boundary is where a null becomes an em dash or, if this is wrong, a
 * zero. Most of these tests are about the difference between "nothing happened"
 * and "nothing is known".
 */

const TRIPLE = {
  strategyName: "gap-fade",
  strategyVersion: "v3",
  instanceId: "instance-hood",
};

function executor(over: Partial<CurrentExecutor> = {}): CurrentExecutor {
  return {
    key: "gap-fade:v3:instance-hood",
    triple: TRIPLE,
    symbols: ["HOOD"],
    allocatedCapital: 200,
    parameters: { universal: { positionSize: 0.9 } },
    execution: { symbols: ["HOOD"], allocatedCapital: 200, dataRequirements: { timeframe: "15Min" } },
    openTrades: [],
    deployedCapital: 0,
    ...over,
  };
}

function current(over: Partial<CurrentState> = {}): CurrentState {
  return {
    environment: "prod",
    manifestStatus: "ok",
    manifestError: null,
    executors: [executor()],
    halt: "active",
    ...over,
  };
}

function dailyRow(over: Partial<DailyPerformanceRow> = {}): DailyPerformanceRow {
  return {
    date: "2026-09-14",
    triple: TRIPLE,
    environment: "live",
    allocatedCapital: 200,
    deployedCapital: 0,
    openPositions: 0,
    realizedPnlDay: 0,
    unrealizedPnl: 0,
    tradesOpened: 0,
    tradesClosed: 0,
    markSource: null,
    isComplete: true,
    dailyPnl: 0,
    cumulativePnl: -11.119,
    dailyReturn: 0,
    ...over,
  };
}

function trade(over: Partial<TradeRow> = {}): TradeRow {
  return {
    tradeId: "t1",
    triple: TRIPLE,
    symbol: "HOOD",
    side: "long",
    environment: "live",
    status: "closed",
    entryDate: "2026-09-10T13:45:00.000Z",
    entryPrice: 108.9,
    quantity: 1.655,
    costBasis: 180.2295,
    exitDate: "2026-09-10T19:43:41.000Z",
    exitPrice: 110.3,
    exitReason: "take_profit",
    pnl: 2.3435,
    pnlPercent: 1.3003,
    holdingPeriodMs: 21461201,
    decisionPrice: null,
    decisionTime: null,
    orderSubmittedTime: null,
    allocatedCapitalAtEntry: null,
    targetPositionValue: null,
    intendedQuantity: null,
    exitDecisionPrice: null,
    exitDecisionTime: null,
    exitOrderSubmittedTime: null,
    entrySlippageBps: null,
    exitSlippageBps: null,
    roundTripSlippageBps: null,
    hasBothDecisionPrices: null,
    entryEvalLatencyMs: null,
    entryBrokerLatencyMs: null,
    entryTotalLatencyMs: null,
    exitEvalLatencyMs: null,
    exitBrokerLatencyMs: null,
    exitTotalLatencyMs: null,
    deploymentRatio: null,
    quantityDeviation: null,
    normalizedReturn: null,
    entryOrderId: null,
    exitOrderId: null,
    entryCorrelationId: null,
    exitCorrelationId: null,
    createdAt: "2026-09-10T13:45:00.000Z",
    updatedAt: "2026-09-10T19:43:41.000Z",
    ...over,
  };
}

function driftRow(over: Partial<DriftRow> = {}): DriftRow {
  return {
    date: "2026-09-14",
    environment: "live",
    equity: 1000,
    lastEquity: 998.5,
    cash: 810.37,
    longMarketValue: 189.63,
    shortMarketValue: 0,
    accountEquityChange: 2.16,
    executorDailyPnlSum: 0.9048,
    executorCount: 3,
    totalAllocatedCapital: 800,
    totalDeployedCapital: 189.63,
    allMarksComplete: true,
    unattributedDelta: 1.2552,
    unattributedFractionOfAllocated: 0.001569,
    ...over,
  };
}

function input(over: Partial<FleetViewInput> = {}): FleetViewInput {
  return {
    current: current(),
    daily: [dailyRow()],
    platform: [],
    closedTrades: [],
    drift: [],
    ...over,
  };
}

describe("a newly deployed executor", () => {
  test("still renders, with unknown figures as null rather than 0", () => {
    // In the manifest, no snapshot rows yet. The card must appear — it is
    // holding real allocated capital — but must not claim a P&L of zero.
    const view = buildFleetView(input({ daily: [] }));

    assert.equal(view.executors.length, 1);
    const card = view.executors[0]!;

    assert.equal(card.cumulativePnl, null);
    assert.notEqual(card.cumulativePnl, 0);
    assert.equal(card.marks.length, 0);
    assert.equal(card.signalNote, "no daily marks yet");
    assert.equal(card.tradesNote, "no closed trades yet");
  });

  test("allocated capital still comes from the manifest", () => {
    const card = buildFleetView(input({ daily: [] })).executors[0]!;
    assert.equal(card.allocated, 200);
  });

  test("zero closed trades is a real count, not an absence", () => {
    const card = buildFleetView(input({ daily: [] })).executors[0]!;
    assert.equal(card.closedTrades, 0);
    assert.equal(card.winRate, null);
  });

  test("the platform total is null, not 0, when nothing has reported", () => {
    // Summing an empty set to zero would claim the book is flat.
    const view = buildFleetView(input({ daily: [] }));
    assert.equal(view.summary.cumulativePnl, null);
  });
});

describe("cumulative P&L comes from the latest row", () => {
  test("uses the last row, never a sum across rows", () => {
    const view = buildFleetView(
      input({
        daily: [
          dailyRow({ date: "2026-09-11", cumulativePnl: -15.04 }),
          dailyRow({ date: "2026-09-14", cumulativePnl: -11.119 }),
        ],
      }),
    );

    assert.equal(view.executors[0]!.cumulativePnl, -11.119);
    assert.equal(view.summary.cumulativePnl, -11.119);
  });

  test("a null on the latest row stays null", () => {
    const view = buildFleetView(
      input({ daily: [dailyRow({ cumulativePnl: null })] }),
    );
    assert.equal(view.executors[0]!.cumulativePnl, null);
  });
});

describe("deployed capital", () => {
  test("flat means a real zero, because no open position is a known fact", () => {
    const card = buildFleetView(input()).executors[0]!;
    assert.equal(card.deployed, 0);
    assert.notEqual(card.deployed, null);
  });

  test("an open position reports its cost basis", () => {
    const view = buildFleetView(
      input({
        current: current({
          executors: [executor({ openTrades: [trade()], deployedCapital: 189.6282 })],
        }),
      }),
    );
    assert.equal(view.executors[0]!.deployed, 189.6282);
    assert.equal(view.executors[0]!.state, "open");
    assert.equal(view.summary.openPositions, 1);
  });
});

describe("executor state", () => {
  test("flat is idle", () => {
    assert.equal(buildFleetView(input()).executors[0]!.state, "idle");
  });

  test("a halted environment marks every card halted", () => {
    const view = buildFleetView(input({ current: current({ halt: "halted" }) }));
    assert.equal(view.executors[0]!.state, "halted");
  });

  test("unknown halt does not silently become halted", () => {
    // 'unknown' is surfaced by HaltNotice as its own page state; the cards
    // themselves must not claim a halt we could not confirm.
    const view = buildFleetView(input({ current: current({ halt: "unknown" }) }));
    assert.equal(view.executors[0]!.state, "idle");
  });
});

describe("drift banner", () => {
  test("hidden when there is no reconciliation row at all", () => {
    assert.equal(buildFleetView(input({ drift: [] })).summary.drift, false);
  });

  test("hidden when the delta is null — unknown is not drift", () => {
    const view = buildFleetView(
      input({ drift: [driftRow({ unattributedDelta: null })] }),
    );
    assert.equal(view.summary.drift, false);
  });

  test("hidden when the delta is exactly zero — the books agree", () => {
    const view = buildFleetView(input({ drift: [driftRow({ unattributedDelta: 0 })] }));
    assert.equal(view.summary.drift, false);
  });

  test("visible on the live delta", () => {
    assert.equal(buildFleetView(input({ drift: [driftRow()] })).summary.drift, true);
  });

  test("visible for a small delta too — any disagreement counts", () => {
    // Below the platform's $1.00 paging threshold, but the books still
    // disagree, and the page's job is to say so.
    const view = buildFleetView(
      input({ drift: [driftRow({ unattributedDelta: 0.02 })] }),
    );
    assert.equal(view.summary.drift, true);
  });

  test("visible for a negative delta", () => {
    const view = buildFleetView(
      input({ drift: [driftRow({ unattributedDelta: -3.5 })] }),
    );
    assert.equal(view.summary.drift, true);
  });

  test("uses the latest row, not the first", () => {
    const view = buildFleetView(
      input({
        drift: [
          driftRow({ date: "2026-09-13", unattributedDelta: 0 }),
          driftRow({ date: "2026-09-14", unattributedDelta: 4.2 }),
        ],
      }),
    );
    assert.equal(view.summary.drift, true);
  });
});

describe("win rate", () => {
  test("counts wins over settled trades", () => {
    assert.equal(winRateOf([trade({ pnl: 1 }), trade({ pnl: -1 })]), 50);
    assert.equal(winRateOf([trade({ pnl: 1 }), trade({ pnl: 1 })]), 100);
  });

  test("excludes trades with an unknown outcome from both sides", () => {
    // An open or unsettled trade has not lost; it has no result yet.
    assert.equal(winRateOf([trade({ pnl: 1 }), trade({ pnl: null })]), 100);
  });

  test("is null when nothing has settled", () => {
    assert.equal(winRateOf([]), null);
    assert.equal(winRateOf([trade({ pnl: null })]), null);
  });

  test("a zero-P&L trade is not a win", () => {
    assert.equal(winRateOf([trade({ pnl: 0 }), trade({ pnl: 1 })]), 50);
  });
});

describe("carried marks", () => {
  test("counted only from the executor's latest row", () => {
    const view = buildFleetView(
      input({
        daily: [
          dailyRow({ date: "2026-09-11", markSource: "carried" }),
          dailyRow({ date: "2026-09-14", markSource: "alpaca" }),
        ],
      }),
    );

    // Carried yesterday, live today — the strip answers "is what I am looking
    // at right now live", not "has anything ever been carried".
    assert.equal(view.executors[0]!.carriedMark, false);
    assert.equal(view.summary.carried.count, 0);
  });

  test("reported with the executor's title when the latest mark is carried", () => {
    const view = buildFleetView(
      input({ daily: [dailyRow({ markSource: "carried" })] }),
    );
    assert.equal(view.summary.carried.count, 1);
    assert.deepEqual(view.summary.carried.titles, ["gap-fade v3 · HOOD"]);
  });
});

describe("platform series", () => {
  const day = (date: string, cw: number | null, ew: number | null): PlatformPerformanceRow => ({
    date,
    capitalWeightedReturn: cw,
    equalWeightedReturn: ew,
    executorCount: 3,
    isComplete: true,
  });

  test("compounds daily returns into a cumulative percent curve", () => {
    const view = buildFleetView(
      input({ platform: [day("2026-09-10", 0.01, 0.01), day("2026-09-11", 0.01, 0.01)] }),
    );

    // (1.01 * 1.01) - 1 = 0.0201 -> 2.01%
    assert.ok(Math.abs(view.series.capitalWeighted[1]!.value - 2.01) < 1e-9);
    assert.ok(Math.abs(view.summary.capitalWeightedReturn! - 2.01) < 1e-9);
  });

  test("a null day contributes nothing rather than counting as 0%", () => {
    // A day with no allocation is not a flat day.
    const view = buildFleetView(
      input({ platform: [day("2026-09-10", 0.01, null), day("2026-09-11", null, null)] }),
    );
    assert.ok(Math.abs(view.series.capitalWeighted[1]!.value - 1) < 1e-9);
    assert.equal(view.summary.equalWeightedReturn, 0);
  });

  test("x positions come from the date, so gaps stay gaps", () => {
    const view = buildFleetView(
      input({ platform: [day("2026-09-11", 0, 0), day("2026-09-14", 0, 0)] }),
    );
    const [friday, monday] = view.series.capitalWeighted;
    // Three days apart in real time, adjacent in the array — the weekend must
    // survive as distance on the axis.
    assert.equal(monday!.t - friday!.t, 3 * 86_400_000);
  });

  test("an empty platform yields null endpoints and says so", () => {
    const view = buildFleetView(input({ platform: [] }));
    assert.equal(view.summary.capitalWeightedReturn, null);
    assert.equal(view.summary.equalWeightedReturn, null);
    assert.match(view.series.provenance, /no platform history/);
  });
});

describe("identity and links", () => {
  test("title reads as the design system specifies", () => {
    assert.equal(buildFleetView(input()).executors[0]!.title, "gap-fade v3 · HOOD");
  });

  test("detail links go through executorHref", () => {
    assert.equal(
      buildFleetView(input()).executors[0]!.href,
      "/executors/gap-fade:v3:instance-hood",
    );
  });
});

describe("strategy character from the manifest", () => {
  test("intraday bar timeframes read as intraday", () => {
    assert.equal(readTimeframe({ dataRequirements: { timeframe: "15Min" } }), "15Min");
    assert.equal(buildFleetView(input()).executors[0]!.character, "intraday");
    assert.equal(buildFleetView(input()).executors[0]!.note, "intraday · 15Min bars");
  });

  test("daily bars read as continuous", () => {
    const view = buildFleetView(
      input({
        current: current({
          executors: [
            executor({ execution: { dataRequirements: { timeframe: "1D" } } }),
          ],
        }),
      }),
    );
    assert.equal(view.executors[0]!.character, "continuous");
  });

  test("no declared timeframe makes no claim about flat days", () => {
    const view = buildFleetView(
      input({ current: current({ executors: [executor({ execution: {} })] }) }),
    );
    assert.equal(view.executors[0]!.character, "continuous");
    assert.equal(view.executors[0]!.note, "continuous");
    assert.equal(readTimeframe({}), null);
  });
});

describe("flattenParameters", () => {
  test("flattens the manifest's nested groups", () => {
    const lines = flattenParameters({
      universal: { positionSize: 0.9, stopLossPercent: 0.03 },
      strategy: { fadeDirection: "down" },
    });

    assert.deepEqual(lines, [
      { label: "positionSize", value: "0.9" },
      { label: "stopLossPercent", value: "0.03" },
      { label: "fadeDirection", value: "down" },
    ]);
  });

  test("a null parameter is a real setting, shown as an em dash", () => {
    // takeProfitPercent: null means "no take-profit", which is information.
    const lines = flattenParameters({ universal: { takeProfitPercent: null } });
    assert.deepEqual(lines, [{ label: "takeProfitPercent", value: "—" }]);
  });

  test("no parameters yields no lines", () => {
    assert.deepEqual(flattenParameters(null), []);
  });
});

describe("summary totals", () => {
  test("allocated sums the manifest values", () => {
    const view = buildFleetView(
      input({
        current: current({
          executors: [
            executor(),
            executor({ key: "gap-fade:v3:instance-snow", allocatedCapital: 400 }),
          ],
        }),
      }),
    );
    assert.equal(view.summary.allocated, 600);
    assert.equal(view.summary.executorCount, 2);
  });

  test("closed trades total matches the cards shown", () => {
    // §5.3: the header must never disagree with the table beneath it.
    const view = buildFleetView(input({ closedTrades: [trade(), trade({ tradeId: "t2" })] }));
    assert.equal(view.summary.closedTrades, 2);
    assert.equal(view.executors[0]!.closedTrades, 2);
  });

  test("asOf is the latest snapshot date", () => {
    const view = buildFleetView(
      input({
        daily: [dailyRow({ date: "2026-09-11" }), dailyRow({ date: "2026-09-14" })],
      }),
    );
    assert.equal(view.summary.asOf, "2026-09-14");
  });

  test("asOf is null when there is no history", () => {
    assert.equal(buildFleetView(input({ daily: [] })).summary.asOf, null);
  });
});
