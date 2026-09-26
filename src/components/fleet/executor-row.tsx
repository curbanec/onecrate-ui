import { Figure, Label, Note } from "@/components/primitives";
import { EXECUTOR_GRID, ROW_MIN_HEIGHT } from "@/lib/design";
import type { Executor } from "@/lib/fleet";
import { ExecutorDetail } from "./executor-detail";
import { SignalSlot } from "./signal-slot";

export function ExecutorRow({
  executor,
  open,
  onToggle,
}: {
  executor: Executor;
  open: boolean;
  onToggle: () => void;
}) {
  const detailId = `executor-${executor.id}-detail`;
  const stop = (event: React.MouseEvent) => event.stopPropagation();

  return (
    <div
      data-card={executor.id}
      onClick={onToggle}
      className="border-hair hover:bg-highlight cursor-pointer border-b"
    >
      {/*
        Below lg the spine becomes a stacked card: identifier and caret on top,
        the four figures in a 2×2 under it, signal full width at the bottom.
        The column header row is hidden there, so each figure carries its own
        label. At lg every cell drops its explicit placement and flows back
        into the shared spine (§5.4).
      */}
      <div
        className="grid grid-cols-[1fr_1fr_24px] items-start gap-x-4 gap-y-3 p-2 lg:[grid-template-columns:var(--executor-grid)] lg:items-center lg:gap-0"
        style={
          {
            "--executor-grid": EXECUTOR_GRID,
            minHeight: ROW_MIN_HEIGHT,
          } as React.CSSProperties
        }
      >
        <div className="col-span-2 lg:col-span-1">
          <a
            href={executor.href}
            onClick={stop}
            className="font-numeric text-data decoration-accent-line text-accent font-medium underline underline-offset-[3px]"
          >
            {executor.title}
          </a>
          {executor.kind === "live" ? (
            <Note className="mt-[3px]">{executor.note}</Note>
          ) : (
            <Note className="mt-[3px]">
              retired · active {executor.activeFrom} to {executor.activeTo}
            </Note>
          )}
        </div>

        <div className="col-start-1 lg:col-start-auto lg:text-right">
          <Label className="mb-1 lg:hidden">allocated</Label>
          <Figure value={executor.allocated} format="currency" precision={0} className="block" />
        </div>
        <div className="col-start-2 lg:col-start-auto lg:text-right">
          <Label className="mb-1 lg:hidden">deployed</Label>
          <Figure value={executor.deployed} format="currency" precision={0} className="block" />
        </div>

        <div className="col-start-1 lg:col-start-auto lg:text-right">
          <Label className="mb-1 lg:hidden">cumulative p&amp;l</Label>
          <Figure
            value={executor.cumulativePnl}
            tone="direction"
            format="currency"
            signed
            carried={executor.kind === "live" && executor.carriedMark}
            className="block font-medium"
          />
        </div>

        <div className="col-start-2 lg:col-start-auto lg:text-right">
          <Label className="mb-1 lg:hidden">trades</Label>
          <Figure value={executor.closedTrades} className="block" />
        </div>

        <div className="col-span-full lg:col-span-1 lg:pl-5">
          <SignalSlot executor={executor} />
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          aria-expanded={open}
          aria-controls={detailId}
          className="text-note text-muted col-start-3 row-start-1 cursor-pointer text-right lg:col-start-auto lg:row-start-auto"
        >
          <span aria-hidden="true">{open ? "−" : "+"}</span>
          <span className="sr-only">
            {open ? "Collapse" : "Expand"} {executor.title}
          </span>
        </button>
      </div>

      {open && (
        <ExecutorDetail executor={executor} id={detailId} onNavigate={stop} />
      )}
    </div>
  );
}
