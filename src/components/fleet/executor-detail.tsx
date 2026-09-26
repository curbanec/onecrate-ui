import { Figure, HatchedSlot, Label, Note } from "@/components/primitives";
import { derivedNote, type Executor } from "@/lib/fleet";

/** Trade exit date, reduced to the day. */
function day(iso: string | null): string {
  return iso === null ? "—" : iso.slice(0, 10);
}

export function ExecutorDetail({
  executor,
  id,
  onNavigate,
}: {
  executor: Executor;
  id: string;
  onNavigate: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      id={id}
      className="bg-highlight grid grid-cols-1 gap-[14px] px-2 pt-0.5 pb-[14px] lg:grid-cols-[1fr_1fr_188px]"
    >
      <div>
        <Label className="mb-1.5">recent trades</Label>
        {executor.recentTrades.length === 0 ? (
          <HatchedSlot variant="block">{executor.tradesNote}</HatchedSlot>
        ) : (
          <div className="text-data-sm font-numeric flex flex-col gap-1 tabular-nums">
            {executor.recentTrades.map((trade) => (
              <div key={trade.id} className="flex items-baseline justify-between gap-3">
                <span className="text-muted">{day(trade.exitDate)}</span>
                <span className="text-ink flex-1 truncate">
                  {trade.symbol ?? "—"}
                  {trade.side ? ` ${trade.side}` : ""}
                </span>
                <Figure
                  value={trade.pnl}
                  tone="direction"
                  size="sm"
                  format="currency"
                  signed
                />
              </div>
            ))}
            <Note className="mt-0.5">{executor.tradesNote}</Note>
          </div>
        )}
      </div>

      <div>
        <Label className="mb-1.5">parameter set</Label>
        {/* Manifest-only, and the manifest is overwritten on every deploy, so a
            retired executor's parameters are genuinely unrecoverable rather than
            merely absent. Never substitute anything derived from the trade log. */}
        {executor.kind === "retired" ? (
          <HatchedSlot variant="block">
            parameter set not recorded at retirement
          </HatchedSlot>
        ) : executor.parameters.length === 0 ? (
          <HatchedSlot variant="block">no parameters in the manifest</HatchedSlot>
        ) : (
          <div className="text-data-sm font-numeric grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
            {executor.parameters.map((parameter) => (
              <div
                key={parameter.label}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="text-muted truncate">{parameter.label}</span>
                <span className="text-ink">{parameter.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-3">
        <div>
          <Label className="mb-1.5">win rate</Label>
          <Figure
            value={executor.winRate}
            size="lg"
            format="percent"
            precision={0}
            className="block"
          />
          <Note className="text-flat mt-[3px]">
            {derivedNote(executor.closedTrades)}
          </Note>
        </div>

        <a
          href={executor.href}
          onClick={onNavigate}
          className="text-note border-accent-line bg-accent-surface text-accent-ink rounded-control border px-[10px] py-2 text-center font-medium no-underline"
        >
          Open detail →
        </a>
      </div>
    </div>
  );
}
