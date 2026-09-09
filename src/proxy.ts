import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

import { canonicalHost, canonicalOrigin } from "@/lib/site";

/**
 * Proxy — Next 16's name for what used to be Middleware. Two jobs, in order:
 * canonicalize the host, then pre-filter unauthenticated requests.
 *
 * The auth check here is deliberately optimistic: it only looks for the session
 * cookie and never touches SQL. Proxy runs on every request including prefetches,
 * so a database round-trip here would be paid on links the user never clicks.
 * The real check is in the DAL, next to the data (lib/dal.ts).
 */

const PROTECTED = ["/fleet"];
const PUBLIC = ["/", "/login"];

export default function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  /**
   * Apex → www. Runtime rather than a next.config redirect because that is
   * baked into the routes manifest at build time, and the promote pipeline ships
   * one image tag to both dev and prod.
   *
   * www is canonical because the apex is pinned to the Container Apps
   * environment's static inbound IP (Wix cannot delegate nameservers, so no
   * CNAME flattening at the apex). If that IP goes stale, a stale apex breaks a
   * redirect instead of the application.
   */
  const host = req.headers.get("host");
  const canonical = canonicalHost();
  if (host && host !== canonical && !isLocal(host)) {
    return NextResponse.redirect(`${canonicalOrigin()}${pathname}${search}`, 308);
  }

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isPublic = PUBLIC.includes(pathname);

  // Presence only — not a validity claim. getSessionCookie does no I/O.
  const hasSession = getSessionCookie(req);

  if (isProtected && !hasSession) {
    const login = new URL("/login", redirectBase(req));
    // Send them back where they were headed once signed in.
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/fleet", redirectBase(req)));
  }

  void isPublic;
  return NextResponse.next();
}

/** Dev and in-cluster health probes have no canonical host to enforce. */
function isLocal(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

/**
 * Base URL for redirects issued from here.
 *
 * Not `req.nextUrl`: behind the Container Apps ingress the app is reached over
 * plain http on an internal address, and nextUrl reflects that rather than the
 * X-Forwarded-Proto/Host the ingress sets. Building on it emits a Location of
 * `http://<internal>:3000/login` — an address the client cannot reach, and http
 * where the session cookie is Secure.
 *
 * The canonical origin is authoritative and already known, so use it. Requests
 * that genuinely are local (dev, health probes) keep their own origin.
 */
function redirectBase(req: NextRequest): string {
  const host = req.headers.get("host");
  return host && isLocal(host) ? req.nextUrl.origin : canonicalOrigin();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|txt)$).*)"],
};
