"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/app/actions/auth";
import { Label } from "@/components/primitives";
import { cn } from "@/lib/utils";

const field = cn(
  "h-9 w-full rounded-control border border-hair bg-raised px-3",
  "text-data text-ink outline-none",
  "focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/40",
);

/**
 * The credential form. A Client Component only because it needs `useActionState`
 * to surface validation errors — the credential check itself stays on the server
 * in the action.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState | undefined, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <Label>Email</Label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={Boolean(state?.errors?.email)}
          className={field}
        />
        {state?.errors?.email && (
          <p className="text-note text-loss">{state.errors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Password</Label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state?.errors?.password)}
          className={field}
        />
        {state?.errors?.password && (
          <p className="text-note text-loss">{state.errors.password}</p>
        )}
      </div>

      {/* Sits above the button so it is not missed, and is announced on change. */}
      {state?.message && (
        <p role="alert" className="text-note text-loss">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "mt-1 h-9 rounded-control bg-accent px-3 text-data font-medium text-white",
          "transition-colors hover:bg-accent-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
