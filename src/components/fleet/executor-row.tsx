import { Figure, Note, SampleNote } from "@/components/primitives";
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
      <div
        className="grid items-center p-2"
        style={{ gridTemplateColumns: EXECUTOR_GRID, minHeight: ROW_MIN_HEIGHT }}
      >
        <div>
          <a
            href={`/executors/${executor.id}`}
            onClick={stop}
            className="font-numeric text-data decoration-accent-line text-accent font-medium underline underline-offset-[3px]"
          >
            {executor.title}
          </a>
          <Note className="mt-[3px]">{executor.note}</Note>
        </div>

        <Figure value={executor.allocated} format="currency" precision={0} className="block text-right" />
        <Figure value={executor.deployed} format="currency" precision={0} className="block text-right" />

        <Figure
          value={executor.cumulativePnl}
          tone="direction"
          format="currency"
          signed
          carried={executor.carriedMark}
          className="block text-right font-medium"
        />

        <div className="text-right">
          <Figure
            value={executor.closedTrades}
            tone="evidence"
            sampleSize={executor.closedTrades}
            className="block"
          />
          <SampleNote sampleSize={executor.closedTrades} className="mt-0.5" />
        </div>

        <div className="pl-5">
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
          className="text-note text-muted cursor-pointer text-right"
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
