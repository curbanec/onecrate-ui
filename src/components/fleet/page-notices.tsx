import type { HaltState, ManifestStatus } from "@/lib/data";

/**
 * Page-level states that are not about a single executor.
 *
 * Both follow the drift banner's rule (§6.5): invisible when there is nothing
 * to say, impossible to ignore when there is. Neither is an always-on readout —
 * a permanent "manifest ok / not halted" strip would be noise that trains the
 * eye to skip the row where the alarm appears.
 */

function Banner({
  tone,
  label,
  detail,
}: {
  tone: "alarm" | "warn";
  label: string;
  detail: string;
}) {
  return (
    <div
      role="alert"
      className={
        tone === "alarm"
          ? "rounded-control text-label mb-[14px] flex gap-[10px] bg-[var(--loss)] px-3 py-[9px] text-white uppercase"
          : "rounded-control text-label border-state-stale mb-[14px] flex gap-[10px] border bg-[var(--raised)] px-3 py-[9px] text-[var(--state-stale)] uppercase"
      }
    >
      <span className="shrink-0">{label}</span>
      <span className="tracking-normal normal-case opacity-90">{detail}</span>
    </div>
  );
}

/**
 * Anything other than a healthy manifest.
 *
 * `empty` is a warning, not an alarm: a legitimately idle environment reports
 * exactly this, and `deployed.dev.json` is `{}` today. `missing` and `invalid`
 * are alarms — the first means the deploy pipeline never uploaded, the second
 * that the document could not be trusted, and in both cases the executor list
 * is empty for a reason the operator must not mistake for "nothing deployed".
 */
export function ManifestNotice({
  status,
  error,
}: {
  status: ManifestStatus;
  error: string | null;
}) {
  if (status === "ok") return null;

  if (status === "empty") {
    return (
      <Banner
        tone="warn"
        label="No executors deployed"
        detail="the deployment manifest for this environment is empty"
      />
    );
  }

  return (
    <Banner
      tone="alarm"
      label={status === "missing" ? "Manifest unavailable" : "Manifest invalid"}
      detail={
        error ??
        "the executor list cannot be trusted — figures below are not a complete picture"
      }
    />
  );
}

/**
 * Kill-switch state.
 *
 * Silent while trading is active. 'unknown' gets its own visible state rather
 * than being folded into either certainty — the read failed, and reporting
 * "active" because we could not find out is the failure mode this whole path
 * exists to avoid. It is a warning rather than an alarm because not knowing is
 * not the same as being halted.
 */
export function HaltNotice({ halt }: { halt: HaltState }) {
  if (halt === "active") return null;

  if (halt === "halted") {
    return (
      <Banner
        tone="alarm"
        label="Trading halted"
        detail="the kill switch is engaged for this environment"
      />
    );
  }

  return (
    <Banner
      tone="warn"
      label="Halt state unknown"
      detail="the kill switch could not be read — assume nothing about whether trading is running"
    />
  );
}
