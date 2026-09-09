"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type Env = "prod" | "dev";

export function EnvToggle({
  value,
  onChange,
  className,
}: {
  value?: Env;
  onChange?: (env: Env) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState<Env>("prod");
  const env = value ?? internal;

  const select = (next: Env) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const tone = (target: Env) => {
    if (env !== target) return "bg-transparent text-muted";
    return target === "prod"
      ? "bg-accent text-white"
      : "bg-accent-surface text-accent-ink";
  };

  return (
    <div
      role="group"
      aria-label="Environment"
      className={cn(
        "border-hair rounded-control flex overflow-hidden border",
        className,
      )}
    >
      {(["prod", "dev"] as const).map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => select(target)}
          aria-pressed={env === target}
          className={cn(
            "text-label flex-1 cursor-pointer border-0 py-1.5 uppercase",
            tone(target),
          )}
        >
          {target}
        </button>
      ))}
    </div>
  );
}
