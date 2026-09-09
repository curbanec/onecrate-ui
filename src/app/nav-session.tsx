import Link from "next/link";

import { optionalSession } from "@/lib/dal";

/**
 * The one part of the splash that depends on the session.
 *
 * Isolated into its own Server Component so the `await` on cookies happens here
 * rather than at the top of the page. A top-level await would hold the entire
 * splash behind a session lookup; scoped this way, the page streams immediately
 * and only this corner waits. See the "Auth and streaming" guidance.
 */
export async function NavSession() {
  const session = await optionalSession();

  return (
    <Link
      href={session ? "/fleet" : "/login"}
      className="text-data text-accent decoration-accent-line underline underline-offset-4 hover:decoration-accent"
    >
      {session ? "Open Fleet →" : "Sign in →"}
    </Link>
  );
}

/** Reserves the link's space while the session resolves, so nothing shifts. */
export function NavSessionFallback() {
  return <span className="text-data text-flat">—</span>;
}
