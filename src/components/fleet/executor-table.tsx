"use client";

import { useState } from "react";
import { Label, StatusDot } from "@/components/primitives";
import { EXECUTOR_GRID } from "@/lib/design";
import type { Executor, LiveExecutor } from "@/lib/fleet";
import { ExecutorRow } from "./executor-row";

const COLUMNS = [
  { label: "executor", align: "" },
  { label: "allocated", align: "text-right" },
  { label: "deployed", align: "text-right" },
  { label: "cumulative p&l", align: "text-right" },
  { label: "trades", align: "text-right" },
  { label: "signal", align: "pl-5" },
] as const;

export function ExecutorTable({ executors }: { executors: Executor[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setOpen((current) => ({ ...current, [id]: !current[id] }));

  // Open-position counts describe running executors. A retired one holds
  // nothing by definition, so it belongs in neither tally nor the denominator.
  const live = executors.filter((e): e is LiveExecutor => e.kind === "live");
  const idle = live.filter((e) => e.state === "idle").length;
  const holding = live.filter((e) => e.state === "open").length;

  return (
    <div>
      <div
        className="border-hair hidden border-b px-2 pt-[14px] pb-2 lg:grid"
        style={{ gridTemplateColumns: EXECUTOR_GRID }}
      >
        {COLUMNS.map((column) => (
          <Label key={column.label} className={column.align}>
            {column.label}
          </Label>
        ))}
        <span />
      </div>

      {executors.map((executor) => (
        <ExecutorRow
          key={executor.id}
          executor={executor}
          open={!!open[executor.id]}
          onToggle={() => toggle(executor.id)}
        />
      ))}

      <div className="text-note text-muted mt-[14px] flex items-center gap-2">
        <StatusDot status={holding > 0 ? "open" : "idle"} />
        <span>
          Open positions — {holding > 0 ? holding : "none"}
          {live.length > 0 && idle === live.length && " · all executors idle"}
        </span>
      </div>
    </div>
  );
}
