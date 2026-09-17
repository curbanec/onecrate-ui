import "server-only";

import { verifySession, type SessionContext } from "@/lib/dal";

/**
 * The data layer's authorization guard.
 *
 * Deliberately a re-export rather than a second implementation. `lib/dal.ts` is
 * the established boundary in this repo (see AUTH.md §4) and it is already
 * wrapped in React's `cache()`, so a page that calls several query functions in
 * one render pass still costs exactly one session lookup. Writing a parallel
 * check here would be the same mistake `auth-db.ts` warns about for the
 * connection: two definitions of one thing, free to drift.
 *
 * Every exported query function calls this first. Not because the page is
 * untrusted, but because a query function is its own entry point — the same
 * reasoning Next's data-security guide applies to Server Actions. A page-level
 * check protects the page, not the function.
 */
export const requireSession = verifySession;

export type { SessionContext };
