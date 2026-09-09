import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";

/**
 * Data Access Layer.
 *
 * The authoritative auth check, deliberately adjacent to the data rather than in
 * a layout. A layout cannot gate rendering — route segments and parallel slots
 * are rendered by the router regardless, and still appear in the RSC payload. So
 * every read goes through verifySession() and nothing reaches a query without it.
 *
 * `cache()` memoizes per render pass, so a page calling this in several
 * components still costs one session lookup.
 */

export interface SessionContext {
  userId: string;
  /** Tenant boundary. Every data query is scoped by this from day one. */
  orgId: string | null;
  email: string;
}

export const verifySession = cache(async (): Promise<SessionContext> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return {
    userId: session.user.id,
    orgId: session.session.activeOrganizationId ?? null,
    email: session.user.email,
  };
});

/**
 * Non-redirecting variant, for places that render differently when signed out
 * rather than bouncing — the splash page's nav, for instance.
 */
export const optionalSession = cache(async (): Promise<SessionContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  return {
    userId: session.user.id,
    orgId: session.session.activeOrganizationId ?? null,
    email: session.user.email,
  };
});
