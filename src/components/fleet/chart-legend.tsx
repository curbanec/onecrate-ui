/**
 * Legend for the platform chart.
 *
 * Each swatch reproduces the treatment it stands for — weight and dash
 * pattern, not just color — because §2.7's two series are distinguished by
 * those as well, so the distinction survives desaturation and printing.
 */
export function ChartLegend() {
  return (
    <div className="text-note text-muted flex flex-none gap-[14px]">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="bg-ink h-0.5 w-[14px]" />
        capital-wtd
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="w-[14px] border-t-[1.5px] border-dashed border-[var(--chart-ew)]" />
        equal-wtd
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="border-flat size-[7px] rounded-full border-[1.5px]" />
        carried mark
      </span>
    </div>
  );
}
