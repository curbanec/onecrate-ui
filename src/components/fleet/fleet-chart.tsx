"use client";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ChartRow, FleetSeries } from "@/lib/fleet";

const DAY = 86_400_000;

const DOT_LIVE = 2.4;
const DOT_CARRIED = 3.2;

const chartConfig = {
  capitalWeighted: { label: "capital-wtd", color: "var(--ink)" },
  equalWeighted: { label: "equal-wtd", color: "var(--chart-ew)" },
} satisfies ChartConfig;

function tickFormatter(span: number) {
  const options: Intl.DateTimeFormatOptions =
    span > 730 * DAY
      ? { year: "numeric" }
      : span > 120 * DAY
        ? { month: "short", year: "2-digit" }
        : { month: "short", day: "numeric" };

  return (t: number) => new Date(t).toLocaleDateString("en-US", options);
}

function niceMax(value: number, ticks = 4): number {
  if (value <= 0) return 1;
  const raw = value / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * magnitude;
  return Math.ceil(value / step) * step;
}

const fullDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const percent = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;

function MarkDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartRow;
}) {
  if (cx == null || cy == null) return null;

  return payload?.carried ? (
    <circle
      cx={cx}
      cy={cy}
      r={DOT_CARRIED}
      fill="none"
      stroke="var(--ink)"
      strokeWidth={1.4}
    />
  ) : (
    <circle cx={cx} cy={cy} r={DOT_LIVE} fill="var(--ink)" />
  );
}

const AXIS_TICK = {
  fill: "var(--muted)",
  fontSize: 11,
  fontFamily: "var(--font-numeric)",
} as const;

export function FleetChart({ series }: { series: FleetSeries }) {
  const span = Date.parse(series.to) - Date.parse(series.from);
  const formatTick = tickFormatter(span);

  return (
    <div className="flex items-stretch gap-1">
      <div className="text-label text-muted flex items-center uppercase">
        <span className="rotate-180 [writing-mode:vertical-rl]">
          cumulative return
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[232px] w-full"
        >
          <LineChart
            data={series.rows}
            margin={{ top: 8, right: 24, bottom: 40, left: 0 }}
          >
        <CartesianGrid
          stroke="var(--hair)"
          strokeDasharray="3 3"
          vertical={false}
        />

        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={formatTick}
          minTickGap={44}
          tickLine={false}
          axisLine={{ stroke: "var(--hair)" }}
          tick={AXIS_TICK}
        />

        <YAxis
          tickFormatter={(v: number) =>
            `${Number.isInteger(v) ? v : v.toFixed(1)}%`
          }
          domain={[(min: number) => Math.min(0, min), (max: number) => niceMax(max)]}
          tickCount={5}
          width={48}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
        />

        <ReferenceLine y={0} stroke="var(--chart-ref)" strokeDasharray="3 3" />

        <ChartTooltip
          cursor={{ stroke: "var(--flat)", strokeDasharray: "3 3", strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                if (!row) return null;
                return (
                  <span className="text-note">
                    {fullDate(row.t)}
                    {row.carried && (
                      <span className="text-flat"> · carried mark</span>
                    )}
                  </span>
                );
              }}
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-0.5 w-3 shrink-0"
                      style={{ background: item.color }}
                    />
                    <span className="text-muted">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                  </span>
                  <span className="font-numeric tabular-nums">
                    {percent(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />

        <Line
          dataKey="equalWeighted"
          type="linear"
          stroke="var(--color-equalWeighted)"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 3, fill: "var(--chart-ew)", stroke: "none" }}
          isAnimationActive={false}
        />
        <Line
          dataKey="capitalWeighted"
          type="linear"
          stroke="var(--color-capitalWeighted)"
          strokeWidth={2}
          dot={<MarkDot />}
          activeDot={{ r: 4, fill: "var(--ink)", stroke: "none" }}
          isAnimationActive={false}
        />

            <Brush
              dataKey="t"
              height={24}
              travellerWidth={10}
              stroke="var(--rule)"
              fill="var(--raised)"
              tickFormatter={formatTick}
            />
          </LineChart>
        </ChartContainer>

        <div className="text-label text-muted mt-1 text-center uppercase">
          trading day
        </div>
      </div>
    </div>
  );
}
