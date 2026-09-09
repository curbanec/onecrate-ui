export function DriftBanner({ drift }: { drift: boolean }) {
  if (!drift) return null;

  return (
    <div
      role="alert"
      className="rounded-control text-label mb-[14px] flex gap-[10px] bg-[var(--loss)] px-3 py-[9px] text-white uppercase"
    >
      <span>Reconciliation drift</span>
      <span className="tracking-normal normal-case opacity-90">
        broker cash and ledger cash disagree
      </span>
    </div>
  );
}
