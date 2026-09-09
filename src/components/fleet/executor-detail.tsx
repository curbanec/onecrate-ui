import { Figure, HatchedSlot, Label, Note } from "@/components/primitives";
import { derivedNote, withhold, type Executor } from "@/lib/fleet";

export function ExecutorDetail({
  executor,
  id,
  onNavigate,
}: {
  executor: Executor;
  id: string;
  onNavigate: (event: React.MouseEvent) => void;
}) {
  const winRate = withhold(executor.winRate, executor.closedTrades);

  return (
    <div
      id={id}
      className="bg-highlight grid gap-[14px] px-2 pt-0.5 pb-[14px]"
      style={{ gridTemplateColumns: "1fr 1fr 188px" }}
    >
      <div>
        <Label className="mb-1.5">recent trades</Label>
        <HatchedSlot variant="block">{executor.tradesNote}</HatchedSlot>
      </div>

      <div>
        <Label className="mb-1.5">parameter set</Label>
        <HatchedSlot variant="block">parameters not supplied in brief</HatchedSlot>
      </div>

      <div className="flex flex-col justify-between">
        <div>
          <Label className="mb-1.5">win rate</Label>
          <Figure
            value={winRate}
            tone="evidence"
            sampleSize={executor.closedTrades}
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
          href={`/executors/${executor.id}`}
          onClick={onNavigate}
          className="text-note border-accent-line bg-accent-surface text-accent-ink rounded-control border px-[10px] py-2 text-center font-medium no-underline"
        >
          Open detail →
        </a>
      </div>
    </div>
  );
}
