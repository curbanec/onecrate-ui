import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import type { Mark } from "@/lib/fleet";
import { DailyMarks, EquityLine } from "./daily-marks";

/**
 * The signal slot is the one region that varies by strategy character (§6.2), and
 * these are the two treatments it can draw. Rendered with `react-dom/server`
 * rather than a DOM harness: the components are pure functions of their marks,
 * and static markup is enough to pin the geometry.
 *
 * The numbers here are not arbitrary. WIDTH 132, HEIGHT 28 and PAD 1.9 put the
 * zero baseline at y=26.1 whenever every value is zero, and the first and last
 * marks at x=1.9 and x=130.1. Asserting them catches a change to the coordinate
 * system, which is the thing most likely to silently ruin the plot.
 */

const mark = (date: string, value: number, carried = false): Mark => ({
  date,
  t: Date.parse(`${date}T00:00:00.000Z`),
  value,
  carried,
});

/** Occurrences of an element tag in the rendered markup. */
const count = (html: string, tag: string) =>
  html.split(`<${tag}`).length - 1;

/**
 * Occurrences of a raw substring — for attributes, which `count` cannot do: it
 * prepends `<` to build a tag search, so passing it an attribute name searches
 * for an element of that name and returns 0 whatever the markup says.
 */
const occurrences = (html: string, needle: string) =>
  html.split(needle).length - 1;

describe("DailyMarks — discrete ticks for intraday and pairs", () => {
  test("draws one tick per day plus the baseline, and no path", () => {
    // The baseline is itself a <line>, so N marks render N+1 of them. Counting
    // without allowing for it is the easy way to write a test that passes for the
    // wrong reason.
    const html = renderToStaticMarkup(
      <DailyMarks
        marks={[
          mark("2026-09-11", -4),
          mark("2026-09-14", 6),
          mark("2026-09-15", 2),
        ]}
        label="marks"
      />,
    );

    assert.equal(count(html, "line"), 4);
    assert.equal(count(html, "path"), 0);
    // Ticks replaced dots: at 2.6px per day a visible dot fused with its
    // neighbours, so nothing here may render as a circle.
    assert.equal(count(html, "circle"), 0);
  });

  test("a tick is vertical and anchored on the zero baseline", () => {
    const html = renderToStaticMarkup(
      <DailyMarks marks={[mark("2026-09-11", 0), mark("2026-09-14", 10)]} label="marks" />,
    );

    // Zero spans to the top of the plot. x and the baseline y land on exact
    // decimals; the far end is 26.1 − 24.2, which in binary floating point is
    // 1.9000000000000021, so it is matched loosely rather than pinned to a value
    // that merely looks round.
    assert.match(html, /x1="130\.1" x2="130\.1" y1="26\.1" y2="1\.9\d*"/);
    assert.match(html, /stroke-width="1\.1"/);
  });

  test("a flat day still renders, as a round-capped zero-length tick", () => {
    // Roughly four days in five close nothing on an intraday strategy. A
    // zero-length tick only shows because of strokeLinecap="round", which paints
    // a dot of stroke-width diameter; without it those days would vanish.
    const html = renderToStaticMarkup(
      <DailyMarks marks={[mark("2026-09-11", 0), mark("2026-09-14", 0)]} label="marks" />,
    );

    assert.match(html, /x1="1\.9" x2="1\.9" y1="26\.1" y2="26\.1"/);
    assert.match(html, /x1="130\.1" x2="130\.1" y1="26\.1" y2="26\.1"/);
    assert.match(html, /stroke-linecap="round"/);
  });

  test("a carried tick is dashed in flat; a live one is solid in ink", () => {
    const html = renderToStaticMarkup(
      <DailyMarks
        marks={[mark("2026-09-11", 5), mark("2026-09-14", 8, true)]}
        label="marks"
      />,
    );

    assert.match(html, /stroke="var\(--flat\)"[^>]*stroke-dasharray="1 1"/);
    assert.match(html, /stroke="var\(--ink\)"/);
    // Exactly one of the two ticks is interrupted.
    assert.equal(occurrences(html, 'stroke-dasharray="1 1"'), 1);
  });

  test("no marks renders nothing rather than an empty frame", () => {
    assert.equal(renderToStaticMarkup(<DailyMarks marks={[]} label="marks" />), "");
  });
});

describe("EquityLine — a connected path for continuous strategies", () => {
  test("draws a path for a continuous executor, not ticks", () => {
    const html = renderToStaticMarkup(
      <EquityLine
        marks={[
          mark("2026-09-11", -4),
          mark("2026-09-14", 6),
          mark("2026-09-15", 2),
        ]}
        label="equity"
      />,
    );

    assert.equal(count(html, "path"), 1);
    // Only the baseline is a line — the days are joined, not ticked.
    assert.equal(count(html, "line"), 1);
    assert.match(html, /d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+"/);
    assert.match(html, /fill="none"/);
    assert.match(html, /stroke="var\(--ink\)"/);
  });

  test("a carried point keeps §6.3's hollow circle instead of breaking the stroke", () => {
    // The position was held through that day, so an interrupted line would claim
    // the position lapsed when only its valuation was second-hand.
    const html = renderToStaticMarkup(
      <EquityLine
        marks={[mark("2026-09-11", 5), mark("2026-09-14", 8, true)]}
        label="equity"
      />,
    );

    assert.equal(count(html, "circle"), 1);
    assert.match(html, /<circle[^>]*fill="none"[^>]*stroke="var\(--flat\)"/);
    // The only dash pattern in the frame is the baseline's 3 3 — the path itself
    // is unbroken, which is the whole point of §6.3's circle here.
    assert.equal(occurrences(html, "stroke-dasharray"), 1);
    assert.doesNotMatch(html, /stroke-dasharray="1 1"/);
  });

  test("no marks renders nothing", () => {
    assert.equal(renderToStaticMarkup(<EquityLine marks={[]} label="equity" />), "");
  });
});

describe("the shared coordinate system", () => {
  test("both treatments place the baseline identically", () => {
    const marks = [mark("2026-09-11", 0), mark("2026-09-14", 4)];
    const ticks = renderToStaticMarkup(<DailyMarks marks={marks} label="a" />);
    const line = renderToStaticMarkup(<EquityLine marks={marks} label="a" />);

    // Same Plot, so the zero line sits at the same y in both.
    assert.match(ticks, /y1="26\.1" y2="26\.1" stroke="var\(--color-chart-ref/);
    assert.match(line, /y1="26\.1" y2="26\.1" stroke="var\(--color-chart-ref/);
  });

  test("the baseline stroke resolves to a defined custom property", () => {
    // `--chart-ref` is not declared anywhere: globals.css defines
    // `--color-chart-ref` inside `@theme inline`, a different name. `stroke` is
    // inherited, so an unresolvable var falls through to `none` and the baseline
    // silently does not draw. The fallback is what guarantees it renders.
    const html = renderToStaticMarkup(
      <DailyMarks marks={[mark("2026-09-11", 1)]} label="a" />,
    );

    assert.match(html, /stroke="var\(--color-chart-ref, var\(--flat\)\)"/);
    assert.doesNotMatch(html, /stroke="var\(--chart-ref\)"/);
  });
});
