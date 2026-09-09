"use client";

import { useState } from "react";
import { Label, StatusDot } from "@/components/primitives";
import { EXECUTOR_GRID } from "@/lib/design";
import type { Executor } from "@/lib/fleet";
import { ExecutorRow } from "./executor-row";

/** Column headers, in spine order (§5.4). */
const COLUMNS = [
  { label: "executor", align: "" },
  { label: "allocated", align: "text-right" },
  { label: "deployed", align: "text-right" },
  { label: "cum. p&l", align: "text-right" },
  { label: "trades", align: "text-right" },
  { label: "signal", align: "pl-5" },
] as const;

/**
 * Executor list (§5.4).
 *
 * Open state is a keyed map rather than a single index, because §5.5 requires
 * that several cards can be open at once — comparing two executors is the
 * whole reason to expand one.
 */
export function ExecutorTable({ executors }: { executors: Executor[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setOpen((current) => ({ ...current, [id]: !current[id] }));

  const idle = executors.filter((e) => e.state === "idle").length;
  const holding = executors.filter((e) => e.state === "open").length;

  return (
    <div>
      <div
        className="border-hair grid border-b px-2 pt-[14px] pb-2"
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
          {idle === executors.length && " · all executors idle"}
        </span>
      </div>
    </div>
  );
}
